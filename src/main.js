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

function foldersFile() {
  return path.join(app.getPath('userData'), 'folders.json');
}

function loadFolders() {
  const file = foldersFile();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveFolders(folders) {
  fs.writeFileSync(foldersFile(), JSON.stringify(folders, null, 2), 'utf8');
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
        return {
          id: f.replace('.json', ''),
          name: data.name,
          type: data.type || 'grid',
          folderId: data.folderId || null,
          lastEdited: stat.mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.lastEdited - a.lastEdited);
});

ipcMain.handle('list-folders', () => loadFolders());

ipcMain.handle('create-folder', (_e, name) => {
  const folders = loadFolders();
  const folder = { id: `folder_${Date.now()}`, name, createdAt: Date.now() };
  folders.push(folder);
  saveFolders(folders);
  return folder;
});

ipcMain.handle('rename-folder', (_e, id, name) => {
  const folders = loadFolders();
  const folder = folders.find(f => f.id === id);
  if (folder) folder.name = name;
  saveFolders(folders);
  return true;
});

ipcMain.handle('delete-folder', (_e, id) => {
  const folders = loadFolders().filter(f => f.id !== id);
  saveFolders(folders);

  // Charts that were inside this folder become unfiled rather than disappearing.
  const dir = chartsDir();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const filePath = path.join(dir, f);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data.folderId === id) {
        data.folderId = null;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch {
      // skip unreadable chart files
    }
  }
  return true;
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

ipcMain.handle('show-unsaved-changes-dialog', async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: 'You have unsaved changes.',
    detail: 'Do you want to save your changes before leaving?',
  });
  return result.response; // 0 = Save, 1 = Don't Save, 2 = Cancel
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
