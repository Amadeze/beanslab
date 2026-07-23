import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(app.getPath("userData"), "logs");
const MAX_LOG_FILES = 5;
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

let currentLogFile: string | null = null;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFilePath(): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  return path.join(LOG_DIR, `artisan-sync-${dateStr}.log`);
}

function rotateLogs() {
  ensureLogDir();
  const files = fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.startsWith("artisan-sync-") && f.endsWith(".log"))
    .sort()
    .reverse();

  // Remove old log files beyond limit
  for (const file of files.slice(MAX_LOG_FILES)) {
    try {
      fs.unlinkSync(path.join(LOG_DIR, file));
    } catch {
      // ignore
    }
  }
}

function writeLog(level: string, message: string, context?: Record<string, unknown>) {
  ensureLogDir();
  const logFile = getLogFilePath();

  if (currentLogFile !== logFile) {
    rotateLogs();
    currentLogFile = logFile;
  }

  // Check if we need to rotate current file
  try {
    const stats = fs.statSync(logFile);
    if (stats.size > MAX_LOG_SIZE) {
      const ext = path.extname(logFile);
      const base = logFile.slice(0, -ext.length);
      const timestamp = Date.now();
      fs.renameSync(logFile, `${base}-${timestamp}${ext}`);
      currentLogFile = null;
    }
  } catch {
    // File doesn't exist yet, that's fine
  }

  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...context,
  };

  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  } catch {
    // Last resort: write to stderr
    console.error(`[${level}] ${message}`, context);
  }
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    writeLog("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    writeLog("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    writeLog("error", message, context);
  },
  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "development") {
      writeLog("debug", message, context);
    }
  },
  getLogDir() {
    return LOG_DIR;
  },
};
