import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { logger } from "./logger";

/**
 * Auto-detect Artisan autosave folder locations.
 * Searches common locations on Windows.
 */

const COMMON_PATHS = [
  // Default Artisan autosave locations
  path.join(os.homedir(), "Documents", "Artisan", "autosave"),
  path.join(os.homedir(), "Documents", "artisan", "autosave"),
  path.join(os.homedir(), "My Documents", "Artisan", "autosave"),
  path.join(os.homedir(), "My Documents", "artisan", "autosave"),
  // Desktop
  path.join(os.homedir(), "Desktop", "Artisan", "autosave"),
  // Downloads
  path.join(os.homedir(), "Downloads", "Artisan", "autosave"),
  // AppData
  path.join(os.homedir(), "AppData", "Local", "Artisan", "autosave"),
  // Common patterns
  path.join(os.homedir(), "Documents", "Roasting", "autosave"),
  path.join(os.homedir(), "Documents", "Coffee", "autosave"),
];

/**
 * Check if a directory exists and contains .alog files.
 */
function isValidArtisanFolder(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) return false;
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return false;

    // Check if folder contains .alog files
    const files = fs.readdirSync(dirPath);
    return files.some((f) => f.toLowerCase().endsWith(".alog"));
  } catch {
    return false;
  }
}

/**
 * Auto-detect Artisan autosave folder.
 * Returns the first valid folder found, or null if none found.
 */
export function detectArtisanFolder(): string | null {
  logger.info("Detecting Artisan autosave folder");

  for (const commonPath of COMMON_PATHS) {
    if (isValidArtisanFolder(commonPath)) {
      logger.info("Auto-detected Artisan folder", { path: commonPath });
      return commonPath;
    }
  }

  // Search for Artisan in common locations
  const searchLocations = [
    path.join(os.homedir(), "Documents"),
    path.join(os.homedir(), "Desktop"),
    path.join(os.homedir(), "Downloads"),
  ];

  for (const location of searchLocations) {
    try {
      if (!fs.existsSync(location)) continue;
      const items = fs.readdirSync(location);
      for (const item of items) {
        if (item.toLowerCase().includes("artisan")) {
          const candidatePath = path.join(location, item, "autosave");
          if (isValidArtisanFolder(candidatePath)) {
            logger.info("Auto-detected Artisan folder", { path: candidatePath });
            return candidatePath;
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  logger.info("No Artisan autosave folder found");
  return null;
}

/**
 * Validate and normalize a folder path.
 */
export function validateFolder(folderPath: string): {
  valid: boolean;
  error?: string;
  alogCount?: number;
} {
  try {
    if (!fs.existsSync(folderPath)) {
      return { valid: false, error: "Folder tidak ditemukan" };
    }

    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      return { valid: false, error: "Path bukan folder" };
    }

    const files = fs.readdirSync(folderPath);
    const alogFiles = files.filter((f) => f.toLowerCase().endsWith(".alog"));

    return {
      valid: true,
      alogCount: alogFiles.length,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Gagal membaca folder: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
