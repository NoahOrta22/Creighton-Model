const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listCharts: () => ipcRenderer.invoke('list-charts'),
  loadChart: (id) => ipcRenderer.invoke('load-chart', id),
  saveChart: (id, data) => ipcRenderer.invoke('save-chart', id, data),
  deleteChart: (id) => ipcRenderer.invoke('delete-chart', id),
  confirmUnsavedChanges: () => ipcRenderer.invoke('show-unsaved-changes-dialog'),
  showSaveDialog: (defaultName) => ipcRenderer.invoke('show-save-dialog', defaultName),
  writeExportFile: (filePath, base64Data, mimeType) =>
    ipcRenderer.invoke('write-export-file', filePath, base64Data, mimeType),
  getAssetsPath: () => ipcRenderer.invoke('get-assets-path'),
  selectChartImage: () => ipcRenderer.invoke('select-chart-image'),
  listFolders: () => ipcRenderer.invoke('list-folders'),
  createFolder: (name) => ipcRenderer.invoke('create-folder', name),
  renameFolder: (id, name) => ipcRenderer.invoke('rename-folder', id, name),
  deleteFolder: (id) => ipcRenderer.invoke('delete-folder', id),
});
