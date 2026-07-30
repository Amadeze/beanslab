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
      // Only clear credentials on explicit revocation (401 UNAUTHORIZED)
      // Network errors, timeouts, and server errors should NOT clear credentials
      if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
        logger.warn("Heartbeat: credential revoked by server");
        this.onAuthExpired?.();
        this.stop();
      } else {
        // Transient errors - just log and retry next interval
        logger.warn("Heartbeat failed (will retry)", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
