import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { logger } from "./logger";

/**
 * Auto-launch on Windows login.
 *
 * Uses a simple registry-based approach for Windows.
 * For production, consider using `auto-launch` npm package
 * for cross-platform support.
 */

function getStartupPath(): string {
  return path.join(
    process.env.APPDATA || "",
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "Artisan Sync.lnk",
  );
}

function getExePath(): string {
  return app.getPath("exe");
}

export function isAutoLaunchEnabled(): boolean {
  try {
    const startupPath = getStartupPath();
    return fs.existsSync(startupPath);
  } catch {
    return false;
  }
}

export function setAutoLaunch(enabled: boolean): void {
  try {
    const startupPath = getStartupPath();

    if (enabled) {
      // Create a .bat launcher in Startup folder
      const batContent = `@echo off\nstart "" "${getExePath()}"\n`;
      fs.writeFileSync(startupPath.replace(".lnk", ".bat"), batContent);
      logger.info("Auto-launch enabled");
    } else {
      // Remove startup entries
      const batPath = startupPath.replace(".lnk", ".bat");
      if (fs.existsSync(batPath)) {
        fs.unlinkSync(batPath);
      }
      if (fs.existsSync(startupPath)) {
        fs.unlinkSync(startupPath);
      }
      logger.info("Auto-launch disabled");
    }
  } catch (err) {
    logger.error("Failed to set auto-launch", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
