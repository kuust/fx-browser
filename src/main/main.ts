import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FxBrowserStore } from './fx-store.js';
import { importMoreLoginFile } from './import-morelogin-file.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let store: FxBrowserStore;

function getStore(): FxBrowserStore {
  if (!store) {
    store = new FxBrowserStore(path.join(app.getPath('userData'), 'data'));
  }
  return store;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: 'FX Browser',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

ipcMain.handle('fx:list-environments', () => {
  return getStore().listEnvironments();
});

ipcMain.handle('fx:get-last-import-summary', () => {
  return getStore().getLastImportSummary();
});

ipcMain.handle('fx:import-morelogin-file', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择 MoreLogin 导出的 export_profile.txt',
    properties: ['openFile'],
    filters: [
      { name: 'MoreLogin TXT Export', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const imported = importMoreLoginFile(result.filePaths[0], getStore());
  return { canceled: false, ...imported };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
