import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { ConnectorCredentials, AppSettings } from "../shared/types";
import { deviceConfigFromSettings } from "../shared/device-config";
import { logger } from "./logger";

const CREDENTIALS_FILE = "credentials.json";
const SETTINGS_FILE = "settings.json";
const INSTALLATION_ID_FILE = "installation-id";

function getAppDataPath(): string {
  const p = path.join(app.getPath("userData"), "data");
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
  return p;
}

export function saveCredentials(credentials: ConnectorCredentials): void {
  try {
    const filePath = path.join(getAppDataPath(), CREDENTIALS_FILE);
    fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
    logger.info("Credentials saved");
  } catch (err) {
    logger.error("Failed to save credentials", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export function loadCredentials(): ConnectorCredentials | null {
  try {
    const filePath = path.join(getAppDataPath(), CREDENTIALS_FILE);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw || !raw.startsWith("{")) return null;
    const data = JSON.parse(raw) as ConnectorCredentials;
    // Validate required fields
    if (!data.connectorId || !data.connectorToken || !data.machineId) return null;
    return data;
  } catch (err) {
    logger.error("Failed to load credentials", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function clearCredentials(): void {
  try {
    const filePath = path.join(getAppDataPath(), CREDENTIALS_FILE);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    logger.info("Credentials cleared");
  } catch (err) {
    logger.error("Failed to clear credentials", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    const filePath = path.join(getAppDataPath(), SETTINGS_FILE);
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), {
      mode: 0o600,
    });
  } catch (err) {
    logger.error("Failed to save settings", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function loadSettings(): AppSettings {
  const defaults: AppSettings = {
    watchFolder: null,
    autoLaunch: false,
    apiBaseUrl: process.env.ARTISAN_SYNC_API_BASE_URL || "https://roastd.id",
    mqttBrokerUrl: process.env.ARTISAN_SYNC_MQTT_BROKER || "mqtt://localhost:1883",
    deviceConfig: null,
    autoReconnectDevice: true,
    selectedSerialPort: null,
    serialAdapter: "AUTO",
    serialBaudRate: 115200,
  };
  try {
    const filePath = path.join(getAppDataPath(), SETTINGS_FILE);
    if (!fs.existsSync(filePath)) {
      return defaults;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<AppSettings> & Record<string, unknown>;
    const merged = { ...defaults, ...parsed } as AppSettings;
    merged.deviceConfig = deviceConfigFromSettings(parsed);
    merged.autoReconnectDevice = parsed.autoReconnectDevice !== false;
    return merged;
  } catch {
    return defaults;
  }
}

export function getOrCreateInstallationId(): string {
  try {
    const filePath = path.join(getAppDataPath(), INSTALLATION_ID_FILE);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8").trim();
    }
    const id = crypto.randomUUID();
    fs.writeFileSync(filePath, id, { mode: 0o600 });
    return id;
  } catch (err) {
    logger.error("Failed to get installation ID", {
      error: err instanceof Error ? err.message : String(err),
    });
    return crypto.randomUUID();
  }
}
