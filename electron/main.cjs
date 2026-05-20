'use strict';

const { app, BrowserWindow, ipcMain, shell, protocol, net, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ── Community folder auto-detect paths ───────────────────────────────────────

const COMMUNITY_PATHS = {
  msfs2020: [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft Flight Simulator', 'Packages', 'Community'),
    path.join(os.homedir(), 'AppData', 'Local', 'Packages', 'Microsoft.FlightSimulator_8wekyb3d8bbwe', 'LocalCache', 'Packages', 'Community'),
  ],
  msfs2024: [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft Flight Simulator 2024', 'Packages', 'Community'),
    path.join(os.homedir(), 'AppData', 'Local', 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalCache', 'Packages', 'Community'),
  ],
};

const fsp = fs.promises;

async function scanPackagesDir(dir, icaoTypes) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); }
  catch { return; }

  for (const pkg of entries) {
    if (!pkg.isDirectory()) continue;
    const airplanesDir = path.join(dir, pkg.name, 'SimObjects', 'Airplanes');
    let variants;
    try { variants = await fsp.readdir(airplanesDir, { withFileTypes: true }); }
    catch { continue; }

    for (const variant of variants) {
      if (!variant.isDirectory()) continue;
      const cfgPath = path.join(airplanesDir, variant.name, 'aircraft.cfg');
      try {
        const buf = await fsp.readFile(cfgPath);
        // Handle both UTF-8 and UTF-16 LE (BOM FF FE)
        const content = buf[0] === 0xFF && buf[1] === 0xFE
          ? buf.toString('utf16le')
          : buf.toString('utf8');
        const match = content.match(/icao_type_designator\s*=\s*([^\r\n;]+)/i);
        if (match) {
          const icao = match[1].trim().replace(/"/g, '');
          if (icao) icaoTypes.add(icao);
        }
      } catch { /* unreadable cfg — skip */ }
    }
  }
}

ipcMain.handle('detect-community-folder', (_, sim) => {
  const candidates = COMMUNITY_PATHS[sim] ?? [];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
});

ipcMain.handle('scan-community-folder', async (_, communityPath) => {
  const icaoTypes = new Set();

  // Scan Community folder itself
  await scanPackagesDir(communityPath, icaoTypes);

  // Also scan sibling Official folder (base sim + marketplace content)
  const officialDir = path.join(path.dirname(communityPath), 'Official');
  try {
    const subdirs = await fsp.readdir(officialDir, { withFileTypes: true });
    await Promise.all(
      subdirs.filter(s => s.isDirectory()).map(s => scanPackagesDir(path.join(officialDir, s.name), icaoTypes))
    );
  } catch { /* no Official sibling — fine */ }

  return [...icaoTypes];
});

ipcMain.handle('open-folder-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select MSFS Community Folder',
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('save-pln', async (event, { content, filename }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    defaultPath: filename,
    filters: [{ name: 'Flight Plan', extensions: ['pln'] }],
    title: 'Save Flight Plan',
  });
  if (result.canceled || !result.filePath) return false;
  await fsp.writeFile(result.filePath, content, 'utf8');
  return true;
});

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
