import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import chokidar from "chokidar";
import { logger } from "./logger";

export type FileStableCallback = (
  filePath: string,
  filename: string,
  fileHash: string,
  fileSize: number,
  fileModifiedAt: Date,
) => void;

const STABILITY_CHECK_INTERVAL_MS = 2000;
const STABILITY_THRESHOLD_MS = 5000;

interface PendingFile {
  timer: NodeJS.Timeout;
  lastSize: number;
  lastMtime: number;
  firstSeen: number;
}

export class FolderWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private pendingFiles = new Map<string, PendingFile>();
  private onStable: FileStableCallback;
  private sentHashes = new Set<string>();

  constructor(onStable: FileStableCallback) {
    this.onStable = onStable;
  }

  start(folderPath: string): void {
    if (!folderPath || !fs.existsSync(folderPath)) {
      logger.error("Watch folder not found", { folderPath });
      return;
    }

    logger.info("Starting folder watcher", { folderPath });

    // Watch the directory itself for better compatibility with chokidar v4
    this.watcher = chokidar.watch(folderPath, {
      ignoreInitial: false,
      persistent: true,
      depth: 0,
    });

    this.watcher.on("add", (filePath: string) => {
      if (!filePath.toLowerCase().endsWith(".alog")) return;
      logger.info("Watcher: add event", { filePath });
      this.handleFile(filePath);
    });
    this.watcher.on("change", (filePath: string) => {
      if (!filePath.toLowerCase().endsWith(".alog")) return;
      logger.info("Watcher: change event", { filePath });
      this.handleFile(filePath);
    });
    this.watcher.on("error", (error: Error | string) => {
      logger.error("Watcher error", { error: String(error) });
    });
    this.watcher.on("ready", () => {
      logger.info("Watcher ready", { folderPath });
      // Scan existing files after ready
      this.scanExistingFiles(folderPath);
    });
  }

  private scanExistingFiles(folderPath: string): void {
    try {
      const files = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith(".alog"));
      logger.info("Scanning existing files", { count: files.length });
      for (const file of files) {
        this.handleFile(path.join(folderPath, file));
      }
    } catch (err) {
      logger.error("Failed to scan existing files", { error: String(err) });
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    // Clear all pending timers
    for (const [, pending] of this.pendingFiles) {
      clearInterval(pending.timer);
    }
    this.pendingFiles.clear();
    logger.info("Folder watcher stopped");
  }

  clearSentHash(hash: string): void {
    this.sentHashes.delete(hash);
  }

  private handleFile(filePath: string): void {
    const filename = path.basename(filePath);

    // Skip if already sent
    const existingPending = this.pendingFiles.get(filePath);
    if (existingPending) {
      // Already being tracked, the interval will pick up changes
      return;
    }

    logger.debug("File detected", { filename });

    const pending: PendingFile = {
      timer: setInterval(() => this.checkStability(filePath), STABILITY_CHECK_INTERVAL_MS),
      lastSize: -1,
      lastMtime: -1,
      firstSeen: Date.now(),
    };

    this.pendingFiles.set(filePath, pending);
    this.checkStability(filePath);
  }

  private checkStability(filePath: string): void {
    const pending = this.pendingFiles.get(filePath);
    if (!pending) return;

    try {
      const stats = fs.statSync(filePath);
      const currentSize = stats.size;
      const currentMtime = stats.mtimeMs;

      if (
        currentSize === pending.lastSize &&
        currentMtime === pending.lastMtime
      ) {
        // File hasn't changed
        const stableFor = Date.now() - Math.max(pending.firstSeen, pending.lastMtime);

        if (
          stableFor >= STABILITY_THRESHOLD_MS &&
          currentSize > 0
        ) {
          // File is stable and non-empty
          clearInterval(pending.timer);
          this.pendingFiles.delete(filePath);

          const fileHash = this.computeHash(filePath);
          const filename = path.basename(filePath);

          if (this.sentHashes.has(fileHash)) {
            logger.debug("File already sent (hash duplicate)", { filename });
            return;
          }

          this.sentHashes.add(fileHash);
          logger.info("File stabilized", {
            filename,
            size: currentSize,
            hash: fileHash.slice(0, 12),
          });

          this.onStable(filePath, filename, fileHash, currentSize, stats.mtime);
        }
      } else {
        // File changed, reset stability tracking
        pending.lastSize = currentSize;
        pending.lastMtime = currentMtime;
        pending.firstSeen = Date.now();
      }
    } catch (err) {
      // File may have been deleted or moved
      clearInterval(pending.timer);
      this.pendingFiles.delete(filePath);
      logger.warn("File access error during stability check", {
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private computeHash(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }
}
