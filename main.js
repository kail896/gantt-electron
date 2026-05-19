const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const RECENT_FILES_PATH = path.join(app.getPath('userData'), 'recent-files.json');

// ===== Recent Files Management =====
function getRecentFiles() {
  try {
    if (fs.existsSync(RECENT_FILES_PATH))
      return JSON.parse(fs.readFileSync(RECENT_FILES_PATH, 'utf-8'));
  } catch (_) {}
  return [];
}

function addRecentFile(filePath) {
  let recent = getRecentFiles();
  recent = recent.filter(f => f !== filePath);
  recent.unshift(filePath);
  if (recent.length > 10) recent = recent.slice(0, 10);
  try {
    fs.writeFileSync(RECENT_FILES_PATH, JSON.stringify(recent, null, 2));
  } catch (_) {}
  if (mainWindow) rebuildMenu();
}

function rebuildMenu() {
  if (mainWindow) {
    const menu = buildMenu();
    Menu.setApplicationMenu(menu);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: '横道图 Gantt',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#f0f2f6',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  createMenu();
}

function buildMenu() {
  const recent = getRecentFiles();
  const recentItems = recent.length > 0
    ? recent.map((f, i) => {
        const name = path.basename(f, '.gantt');
        const dir = path.dirname(f);
        return {
          label: `${i < 9 ? '⌘' + (i + 1) + '  ' : '   '}${name}  —  ${dir}`,
          accelerator: i < 9 ? `CmdOrCtrl+${i + 1}` : undefined,
          click: () => mainWindow?.webContents.send('menu-open-file', f)
        };
      })
    : [{ label: '无最近文件', enabled: false }];

  const template = [
    {
      label: '横道图',
      submenu: [
        { role: 'about', label: '关于 横道图' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '文件',
      submenu: [
        {
          label: '新建项目',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu-new')
        },
        {
          label: '打开项目...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu-open')
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu-save')
        },
        {
          label: '另存为...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu-save-as')
        },
        { type: 'separator' },
        {
          label: '最近文件',
          submenu: recentItems
        },
        { type: 'separator' },
        {
          label: '导入 Excel (I)',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow?.webContents.send('menu-import')
        },
        {
          label: '导出 Excel (E)',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu-export')
        },
        { type: 'separator' },
        {
          label: '导出 PDF (P)',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow?.webContents.send('menu-export-pdf')
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu-undo') },
        { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', click: () => mainWindow?.webContents.send('menu-redo') },
        { type: 'separator' },
        { label: '添加任务', accelerator: 'CmdOrCtrl+T', click: () => mainWindow?.webContents.send('menu-add-task') },
        { label: '添加子任务', accelerator: 'CmdOrCtrl+Shift+T', click: () => mainWindow?.webContents.send('menu-add-child') },
        { label: '删除任务', accelerator: 'Delete', click: () => mainWindow?.webContents.send('menu-delete') }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '日视图',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow?.webContents.send('menu-zoom', 'day')
        },
        {
          label: '周视图',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow?.webContents.send('menu-zoom', 'week')
        },
        {
          label: '月视图',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow?.webContents.send('menu-zoom', 'month')
        },
        { type: 'separator' },
        {
          label: '展开全部',
          click: () => mainWindow?.webContents.send('menu-expand')
        },
        {
          label: '折叠全部',
          click: () => mainWindow?.webContents.send('menu-collapse')
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { role: 'toggleDevTools', label: '开发者工具' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 横道图',
          click: () => mainWindow?.webContents.send('menu-about')
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

function createMenu() {
  const menu = buildMenu();
  Menu.setApplicationMenu(menu);
}

// ===== IPC Handlers =====
ipcMain.handle('file-save', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    addRecentFile(filePath);
    return { success: true, filePath, fileName: path.basename(filePath) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file-save-as', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存项目',
    defaultPath: path.join(app.getPath('documents'), '未命名项目.gantt'),
    filters: [{ name: '横道图项目文件 (*.gantt)', extensions: ['gantt'] }]
  });
  if (result.canceled) return { success: false, canceled: true };
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    addRecentFile(result.filePath);
    return { success: true, filePath: result.filePath, fileName: path.basename(result.filePath) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file-open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开项目',
    filters: [
      { name: '横道图项目文件 (*.gantt)', extensions: ['gantt'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const data = JSON.parse(raw);
    addRecentFile(result.filePaths[0]);
    return { success: true, filePath: result.filePaths[0], fileName: path.basename(result.filePaths[0]), data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file-open-by-path', async (event, filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    addRecentFile(filePath);
    return { success: true, filePath, fileName: path.basename(filePath), data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-recent-files', () => getRecentFiles());

ipcMain.handle('clear-recent-files', () => {
  try {
    fs.writeFileSync(RECENT_FILES_PATH, '[]');
    rebuildMenu();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-pdf', async (event, html) => {
  const printWin = new BrowserWindow({
    show: false,
    width: 1200, height: 900,
    webPreferences: { sandbox: false, contextIsolation: false, nodeIntegration: false }
  });
  try {
    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(r => setTimeout(r, 1000));
    const pdfBuffer = await printWin.webContents.printToPDF({
      landscape: true, printBackground: true, pageSize: 'A4',
      margins: { marginType: 'printableArea' }
    });
    printWin.close();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出 PDF',
      defaultPath: path.join(app.getPath('documents'), '横道图_' + new Date().toISOString().slice(0, 10) + '.pdf'),
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    });
    if (result.canceled) return { success: false, canceled: true };
    fs.writeFileSync(result.filePath, pdfBuffer);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    if (!printWin.isClosed()) printWin.close();
    return { success: false, error: err.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
