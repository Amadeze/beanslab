import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { logger } from "./logger";

const QUEUE_FILE = "upload-queue.json";

interface QueueItem {
  id: number;
  absolute_path: string;
  filename: string;
  file_hash: string | null;
  file_modified_at: string | null;
  status: "PENDING" | "UPLOADING" | "UPLOADED" | "FAILED";
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  uploaded_at: string | null;
}

const RETRY_DELAYS_MS = [
  5000, 15000, 30000, 60000, 300000, 900000, 3600000,
];

function getDataDir(): string {
  const p = path.join(app.getPath("userData"), "data");
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
  return p;
}

function getQueuePath(): string {
  return path.join(getDataDir(), QUEUE_FILE);
}

export class UploadQueue {
  private items: QueueItem[] = [];
  private nextId = 1;

  constructor() {
    this.load();
  }

  async init(): Promise<void> {
    // Already loaded in constructor
    logger.info("Upload queue initialized", { items: this.items.length });
  }

  private load(): void {
    try {
      const filePath = getQueuePath();
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        this.items = data.items || [];
        this.nextId = data.nextId || 1;
      }
    } catch (err) {
      logger.error("Failed to load queue", { error: String(err) });
      this.items = [];
    }
  }

  private save(): void {
    try {
      const filePath = getQueuePath();
      fs.writeFileSync(filePath, JSON.stringify({ items: this.items, nextId: this.nextId }, null, 2));
    } catch (err) {
      logger.error("Failed to save queue", { error: String(err) });
    }
  }

  enqueue(
    absolutePath: string,
    filename: string,
    fileHash: string,
    fileModifiedAt: Date,
  ): boolean {
    // Dedup by file hash
    const existing = this.items.find((i) => i.file_hash === fileHash);
    if (existing) {
      logger.debug("File already in queue (hash dedup)", { filename });
      return false;
    }

    const item: QueueItem = {
      id: this.nextId++,
      absolute_path: absolutePath,
      filename,
      file_hash: fileHash,
      file_modified_at: fileModifiedAt.toISOString(),
      status: "PENDING",
      attempts: 0,
      next_attempt_at: null,
      last_error: null,
      created_at: new Date().toISOString(),
      uploaded_at: null,
    };

    this.items.push(item);
    this.save();

    logger.info("File queued for upload", { filename, hash: fileHash.slice(0, 12) });
    return true;
  }

  getNextPending(): QueueItem | null {
    const now = new Date().toISOString();
    return (
      this.items.find(
        (i) =>
          i.status === "PENDING" &&
          (!i.next_attempt_at || i.next_attempt_at <= now),
      ) ?? null
    );
  }

  markUploading(id: number): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      item.status = "UPLOADING";
      this.save();
    }
  }

  markUploaded(id: number): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      item.status = "UPLOADED";
      item.uploaded_at = new Date().toISOString();
      this.save();
    }
    logger.info("Upload completed", { id });
  }

  markFailed(id: number, error: string): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      item.attempts += 1;
      const delayIndex = Math.min(item.attempts - 1, RETRY_DELAYS_MS.length - 1);
      item.next_attempt_at = new Date(
        Date.now() + RETRY_DELAYS_MS[delayIndex],
      ).toISOString();
      item.last_error = error;
      item.status = "PENDING";
      this.save();

      logger.warn("Upload failed, scheduled retry", {
        id,
        attempts: item.attempts,
        nextAttempt: item.next_attempt_at,
        error,
      });
    }
  }

  getPendingCount(): number {
    return this.items.filter((i) => i.status === "PENDING").length;
  }

  getFileBuffer(filePath: string): Buffer | null {
    try {
      return fs.readFileSync(filePath);
    } catch {
      return null;
    }
  }

  resumePending(): QueueItem[] {
    // Reset any UPLOADING items back to PENDING (app crashed during upload)
    for (const item of this.items) {
      if (item.status === "UPLOADING") {
        item.status = "PENDING";
      }
    }
    this.save();

    return this.items.filter((i) => i.status === "PENDING");
  }

  close(): void {
    this.save();
  }
}
