const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f0eb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'home.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- File system helpers ---

function chartsDir() {
  const dir = path.join(app.getPath('userData'), 'charts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function imagesDir() {
  const dir = path.join(app.getPath('userData'), 'images');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// --- IPC handlers ---

ipcMain.handle('list-charts', () => {
  const dir = chartsDir();
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const filePath = path.join(dir, f);
      const stat = fs.statSync(filePath);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { id: f.replace('.json', ''), name: data.name, type: data.type || 'grid', lastEdited: stat.mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.lastEdited - a.lastEdited);
});

ipcMain.handle('load-chart', (_e, id) => {
  const filePath = path.join(chartsDir(), `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
});

ipcMain.handle('save-chart', (_e, id, data) => {
  const filePath = path.join(chartsDir(), `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return true;
});

ipcMain.handle('delete-chart', (_e, id) => {
  const filePath = path.join(chartsDir(), `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

ipcMain.handle('show-save-dialog', async (_e, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('downloads'), `${defaultName}.png`),
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'PDF', extensions: ['pdf'] },
    ],
  });
  return result;
});

ipcMain.handle('write-export-file', (_e, filePath, base64Data, mimeType) => {
  const buf = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buf);
  return true;
});

ipcMain.handle('select-chart-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'PNG', 'JPG', 'JPEG'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const srcPath = result.filePaths[0];
  const ext     = path.extname(srcPath).toLowerCase();
  const imageId = `img_${Date.now()}`;
  const destPath = path.join(imagesDir(), `${imageId}${ext}`);
  fs.copyFileSync(srcPath, destPath);
  return destPath;
});

ipcMain.handle('get-assets-path', () => {
  // In dev, assets/ is relative to project root; in packaged app use extraResources
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(app.getAppPath(), 'assets');
});
