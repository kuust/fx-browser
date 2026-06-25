import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FxBrowserStore } from './fx-store.js';
import { importMoreLoginFile } from './import-morelogin-file.js';
import { BrowserProcessManager } from './browser-process-manager.js';
import { findDefaultBrowserExecutable } from './browser-launcher.js';
import { LocalProxyBridgeManager } from './local-proxy-bridge-manager.js';
import { ProxyChecker } from './proxy-checker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let store: FxBrowserStore;
let browserManager: BrowserProcessManager;
let proxyBridgeManager: LocalProxyBridgeManager;
let proxyChecker: ProxyChecker;

function getStore(): FxBrowserStore {
  if (!store) {
    store = new FxBrowserStore(path.join(app.getPath('userData'), 'data'));
  }
  return store;
}

function getProxyBridgeManager(): LocalProxyBridgeManager {
  if (!proxyBridgeManager) {
    proxyBridgeManager = new LocalProxyBridgeManager();
  }
  return proxyBridgeManager;
}

function getProxyChecker(): ProxyChecker {
  if (!proxyChecker) {
    proxyChecker = new ProxyChecker({
      startBridge: (plan) => getProxyBridgeManager().start(plan),
      stopBridge: (environmentId) => getProxyBridgeManager().stop(environmentId),
    });
  }
  return proxyChecker;
}

function getBrowserManager(): BrowserProcessManager {
  if (!browserManager) {
    browserManager = new BrowserProcessManager({
      appUserDataDir: app.getPath('userData'),
      executablePathProvider: () => findDefaultBrowserExecutable(),
      startProxyBridge: (plan) => getProxyBridgeManager().start(plan),
      stopProxyBridge: (environmentId) => { void getProxyBridgeManager().stop(environmentId); },
      markStatus: (environmentId, status) => getStore().markEnvironmentStatus(environmentId, status),
      markCookieImportResult: (environmentId, result) => getStore().markCookieImportResult(environmentId, result),
    });
  }
  return browserManager;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: 'FX Browser',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
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

ipcMain.handle('fx:start-environment', async (_event, environmentId: string) => {
  const environment = getStore().getEnvironment(environmentId);
  if (!environment) throw new Error(`环境不存在：${environmentId}`);
  const result = await getBrowserManager().start(environment);
  return { ...result, environments: getStore().listEnvironments() };
});

ipcMain.handle('fx:stop-environment', (_event, environmentId: string) => {
  const result = getBrowserManager().stop(environmentId);
  return { ...result, environments: getStore().listEnvironments() };
});

ipcMain.handle('fx:check-proxy', async (_event, environmentId: string) => {
  const environment = getStore().getEnvironment(environmentId);
  if (!environment) throw new Error(`环境不存在：${environmentId}`);
  return getProxyChecker().check(environment);
});

ipcMain.handle('fx:reset-cookie-import', (_event, environmentId: string) => {
  getStore().resetCookieImport(environmentId);
  return { environmentId, environments: getStore().listEnvironments() };
});

ipcMain.handle('fx:list-proxies', () => {
  return getStore().listProxies();
});

ipcMain.handle('fx:save-proxies', (_event, proxies) => {
  getStore().saveProxies(proxies);
  return getStore().listProxies();
});

ipcMain.handle('fx:get-environment-draft', () => {
  return getStore().getEnvironmentDraft();
});

ipcMain.handle('fx:save-environment-draft', (_event, draft) => {
  getStore().saveEnvironmentDraft(draft);
  return getStore().getEnvironmentDraft();
});

function currentVersion(): string {
  const packageJsonPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'package.json')
    : path.join(__dirname, '../../package.json');
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return packageJson.version ?? app.getVersion();
  } catch {
    return app.getVersion();
  }
}

ipcMain.handle('fx:check-for-updates', async () => {
  const releasesUrl = 'https://github.com/kuust/fx-browser/releases/latest';
  if (!app.isPackaged) {
    return {
      currentVersion: currentVersion(),
      latestVersion: null,
      hasUpdate: null,
      releasesUrl,
      message: '开发模式不会自动更新；打包安装版可在客户端内检查、下载并安装更新。',
    };
  }

  const result = await autoUpdater.checkForUpdates();
  const latestVersion = result?.updateInfo?.version ?? null;
  return {
    currentVersion: currentVersion(),
    latestVersion,
    hasUpdate: Boolean(latestVersion && latestVersion !== currentVersion()),
    releasesUrl,
    message: latestVersion && latestVersion !== currentVersion()
      ? `发现新版本 ${latestVersion}，可以直接下载并安装。`
      : '当前已经是最新版本。',
  };
});

ipcMain.handle('fx:download-update', async () => {
  if (!app.isPackaged) {
    return { downloaded: false, message: '开发模式不能下载更新，请使用打包安装版。' };
  }
  await autoUpdater.downloadUpdate();
  return { downloaded: true, message: '更新已下载完成，点击“安装并重启”完成升级。' };
});

ipcMain.handle('fx:install-update', () => {
  autoUpdater.quitAndInstall(false, true);
  return { installing: true };
});

ipcMain.handle('fx:open-updates-page', async () => {
  const releasesUrl = 'https://github.com/kuust/fx-browser/releases/latest';
  await shell.openExternal(releasesUrl);
  return { opened: true, releasesUrl };
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
