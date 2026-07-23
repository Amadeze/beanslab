const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow;
let tray;

app.whenReady().then(() => {
  console.log('[DEBUG] Creating window...');

  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    title: 'Artisan Sync',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  console.log('[DEBUG] Loading HTML...');
  mainWindow.loadFile(path.join(__dirname, 'dist/renderer/index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[DEBUG] HTML loaded');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[DEBUG] Failed to load:', errorCode, errorDescription);
  });

  console.log('[DEBUG] Creating tray...');
  tray = new Tray(path.join(__dirname, 'assets/icon.png'));
  tray.setToolTip('Artisan Sync');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: () => mainWindow.show() },
    { label: 'Quit', click: () => app.quit() },
  ]));

  console.log('[DEBUG] Done');
});

app.on('window-all-closed', () => {
  console.log('[DEBUG] All windows closed');
  // Keep running in tray
});
