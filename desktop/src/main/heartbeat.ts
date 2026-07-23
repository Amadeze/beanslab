import os from "os";
import { ApiClient, ApiError } from "./api-client";
import { logger } from "./logger";
import type { HeartbeatRequest } from "../shared/types";

const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

export class HeartbeatSender {
  private interval: NodeJS.Timeout | null = null;
  private apiClient: ApiClient;
  private token: string;
  private appVersion: string;
  private getQueueSize: () => number;
  private getWatchFolderConfigured: () => boolean;
  private onAuthExpired?: () => void;

  constructor(opts: {
    apiClient: ApiClient;
    token: string;
    appVersion: string;
    getQueueSize: () => number;
    getWatchFolderConfigured: () => boolean;
    onAuthExpired?: () => void;
  }) {
    this.apiClient = opts.apiClient;
    this.token = opts.token;
    this.appVersion = opts.appVersion;
    this.getQueueSize = opts.getQueueSize;
    this.getWatchFolderConfigured = opts.getWatchFolderConfigured;
    this.onAuthExpired = opts.onAuthExpired;
  }

  start(): void {
    if (this.interval) return;
    // Send first heartbeat immediately
    this.send();
    this.interval = setInterval(() => this.send(), HEARTBEAT_INTERVAL_MS);
    logger.info("Heartbeat started");
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info("Heartbeat stopped");
  }

  updateToken(token: string): void {
    this.token = token;
  }

  private async send(): Promise<void> {
    try {
      const data: HeartbeatRequest = {
        appVersion: this.appVersion,
        computerName: os.hostname(),
        queueSize: this.getQueueSize(),
        watchFolderConfigured: this.getWatchFolderConfigured(),
      };

      await this.apiClient.heartbeat(data, this.token);
      logger.debug("Heartbeat sent");
    } catch (err) {
      if (err instanceof ApiError && (err.code === "UNAUTHORIZED" || err.code === "AUTH_REQUIRED" || err.code === "CONNECTOR_NOT_FOUND")) {
        logger.warn("Heartbeat auth expired or connector not found");
        this.onAuthExpired?.();
        this.stop();
      } else {
        logger.warn("Heartbeat failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
