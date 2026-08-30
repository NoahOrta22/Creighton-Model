const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
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

// --- Auto-update (electron-updater / GitHub Releases) ---
// Only meaningful in a packaged build: there is no update feed to hit when
// running via `electron .` in dev, and electron-updater errors out noisily
// if it tries. It only ever replaces the installed app bundle — it never
// touches userData(), where all charts/images/folders live.
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const RELEASES_URL = 'https://github.com/NoahOrta22/Creighton-Model/releases/latest';

// Silent background-download-then-relaunch updates require the app to be
// code-signed with an Apple Developer ID — on macOS, electron-updater refuses
// to install an update whose signature it can't validate against the running
// app. Without that certificate, the best we can do there is detect a new
// version and send the user to download it themselves. Windows/Linux don't
// have this restriction, so they get the full silent flow.
const CAN_AUTO_INSTALL = process.platform !== 'darwin';

function initAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = CAN_AUTO_INSTALL;
  autoUpdater.autoInstallOnAppQuit = CAN_AUTO_INSTALL;

  autoUpdater.on('error', (err) => {
    // Covers offline users, GitHub being unreachable, etc. — never fatal.
    console.error('[auto-updater] error:', err?.stack || err?.message || err);
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[auto-updater] checking for update…');
  });

  autoUpdater.on('update-available', (info) => {
    if (CAN_AUTO_INSTALL) {
      console.log('[auto-updater] update available:', info.version, '— downloading in background');
      return;
    }
    console.log('[auto-updater] update available:', info.version, '— prompting for manual download (unsigned build)');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available.`,
      detail: "This build isn't code-signed, so it can't install updates automatically. Download it from GitHub and replace the app in Applications — your saved charts are stored separately and won't be affected.",
      buttons: ['View Release', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) shell.openExternal(RELEASES_URL);
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[auto-updater] already on the latest version');
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart the app to install it. Your saved charts are stored separately and will not be affected.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[auto-updater] check failed:', err?.message || err);
    });
  };

  checkForUpdates();
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
}

app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
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
