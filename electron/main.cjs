'use strict';

const { app, BrowserWindow, ipcMain, shell, protocol, net } = require('electron');
const path = require('path');

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

const CONTENT_WIDTH = 900;

function createWindow() {
  const win = new BrowserWindow({
    width: CONTENT_WIDTH,
    height: 600,
    minWidth: 640,
    minHeight: 480,
    title: 'Flight Roulette',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.loadURL('app://localhost/index.html');
  win.setMenuBarVisibility(false);

  win.webContents.once('did-finish-load', () => {
    win.webContents.executeJavaScript(
      'document.querySelector("#view-main .app-shell").offsetHeight'
    ).then((contentH) => {
      const [outerW, outerH] = win.getSize();
      const [innerW, innerH] = win.getContentSize();
      const chromeH = outerH - innerH;
      const chromeW = outerW - innerW;
      win.setSize(CONTENT_WIDTH + chromeW, Math.max(480, contentH) + chromeH);
      win.show();
    });
  });

  ipcMain.removeAllListeners('resize-to-height');
  ipcMain.on('resize-to-height', (_, contentH) => {
    const [outerW, outerH] = win.getSize();
    const [, innerH] = win.getContentSize();
    const chromeH = outerH - innerH;
    win.setSize(outerW, Math.max(480, contentH) + chromeH);
  });

  // Open all target="_blank" links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept navigations away from app:// (e.g. SimBrief dispatch link clicks)
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  // Map app://localhost/* → <appPath>/*
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const filePath = path.join(app.getAppPath(), url.pathname);
    return net.fetch(`file://${filePath}`);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
