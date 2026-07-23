const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL('data:text/html,<h1>Artisan Sync Test</h1><p>If you see this, Electron works!</p>');

  win.webContents.on('did-finish-load', () => {
    console.log('Window loaded successfully');
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
