const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Existing menu event listeners
  onMenuImport: (cb) => ipcRenderer.on('menu-import', () => cb()),
  onMenuExport: (cb) => ipcRenderer.on('menu-export', () => cb()),
  onMenuAddTask: (cb) => ipcRenderer.on('menu-add-task', () => cb()),
  onMenuAddChild: (cb) => ipcRenderer.on('menu-add-child', () => cb()),
  onMenuDelete: (cb) => ipcRenderer.on('menu-delete', () => cb()),
  onMenuZoom: (cb) => ipcRenderer.on('menu-zoom', (_, level) => cb(level)),
  onMenuExpand: (cb) => ipcRenderer.on('menu-expand', () => cb()),
  onMenuCollapse: (cb) => ipcRenderer.on('menu-collapse', () => cb()),

  // File operation IPC (invoke = async response)
  saveFile: (filePath, data) => ipcRenderer.invoke('file-save', filePath, data),
  saveFileAs: (data) => ipcRenderer.invoke('file-save-as', data),
  openFile: () => ipcRenderer.invoke('file-open'),
  openFileByPath: (filePath) => ipcRenderer.invoke('file-open-by-path', filePath),
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  clearRecentFiles: () => ipcRenderer.invoke('clear-recent-files'),

  // New menu event listeners for file operations
  onMenuNew: (cb) => ipcRenderer.on('menu-new', () => cb()),
  onMenuSave: (cb) => ipcRenderer.on('menu-save', () => cb()),
  onMenuSaveAs: (cb) => ipcRenderer.on('menu-save-as', () => cb()),
  onMenuOpen: (cb) => ipcRenderer.on('menu-open', () => cb()),
  onMenuOpenFile: (cb) => ipcRenderer.on('menu-open-file', (_, filePath) => cb(filePath)),
  onMenuUndo: (cb) => ipcRenderer.on('menu-undo', () => cb()),
  onMenuRedo: (cb) => ipcRenderer.on('menu-redo', () => cb()),
  onMenuAbout: (cb) => ipcRenderer.on('menu-about', () => cb()),
  onMenuExportPdf: (cb) => ipcRenderer.on('menu-export-pdf', () => cb()),

  // PDF export
  exportPdf: (html) => ipcRenderer.invoke('export-pdf', html)
});
