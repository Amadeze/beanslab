import { Tray, Menu, nativeImage, app, BrowserWindow } from "electron";
import * as path from "path";
import type { AppStatus } from "../shared/types";
import { logger } from "./logger";

export class SystemTray {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private status: AppStatus = "pairing";

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  create(): void {
    // Create a simple 16x16 tray icon
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setToolTip("Artisan Sync");

    this.tray.on("click", () => {
      this.mainWindow?.show();
      this.mainWindow?.focus();
    });

    this.updateMenu();
  }

  setStatus(status: AppStatus): void {
    this.status = status;
    this.updateMenu();
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private updateMenu(): void {
    if (!this.tray) return;

    const statusLabels: Record<AppStatus, string> = {
      pairing: "⏳ Menunggu pairing",
      connected: "✅ Terhubung",
      offline: "🔴 Offline",
      syncing: "🔄 Menyinkronkan",
      auth_expired: "⚠️ Autentikasi kedaluwarsa",
      folder_unavailable: "⚠️ Folder tidak tersedia",
    };

    const contextMenu = Menu.buildFromTemplate([
      {
        label: statusLabels[this.status],
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Buka Artisan Sync",
        click: () => {
          this.mainWindow?.show();
          this.mainWindow?.focus();
        },
      },
      {
        label: "Sync Sekarang",
        click: () => {
          this.mainWindow?.webContents.send("sync-now");
        },
      },
      { type: "separator" },
      {
        label: "Buka Folder Log",
        click: () => {
          const { shell } = require("electron");
          shell.openPath(path.join(app.getPath("userData"), "logs"));
        },
      },
      {
        label: "Mulai saat Windows menyala",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({
            openAtLogin: menuItem.checked,
          });
          logger.info("Auto-launch toggled", { enabled: menuItem.checked });
        },
      },
      { type: "separator" },
      {
        label: "Putuskan",
        click: () => {
          this.mainWindow?.webContents.send("disconnect");
        },
      },
      {
        label: "Keluar",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);

    const tooltipStatus: Record<AppStatus, string> = {
      pairing: "Artisan Sync - Menunggu pairing",
      connected: "Artisan Sync - Terhubung",
      offline: "Artisan Sync - Offline",
      syncing: "Artisan Sync - Menyinkronkan",
      auth_expired: "Artisan Sync - Autentikasi kedaluwarsa",
      folder_unavailable: "Artisan Sync - Folder tidak tersedia",
    };
    this.tray.setToolTip(tooltipStatus[this.status]);
  }
}
