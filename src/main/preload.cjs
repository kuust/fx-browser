const { contextBridge, ipcRenderer } = require('electron');

const bridgeApi = {
  listEnvironments: () => ipcRenderer.invoke('fx:list-environments'),
  getLastImportSummary: () => ipcRenderer.invoke('fx:get-last-import-summary'),
  importMoreLoginFile: () => ipcRenderer.invoke('fx:import-morelogin-file'),
  startEnvironment: (environmentId) => ipcRenderer.invoke('fx:start-environment', environmentId),
  stopEnvironment: (environmentId) => ipcRenderer.invoke('fx:stop-environment', environmentId),
  checkProxy: (environmentId) => ipcRenderer.invoke('fx:check-proxy', environmentId),
  resetCookieImport: (environmentId) => ipcRenderer.invoke('fx:reset-cookie-import', environmentId),
  listProxies: () => ipcRenderer.invoke('fx:list-proxies'),
  saveProxies: (proxies) => ipcRenderer.invoke('fx:save-proxies', proxies),
  getEnvironmentDraft: () => ipcRenderer.invoke('fx:get-environment-draft'),
  saveEnvironmentDraft: (draft) => ipcRenderer.invoke('fx:save-environment-draft', draft),
  checkForUpdates: () => ipcRenderer.invoke('fx:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('fx:download-update'),
  installUpdate: () => ipcRenderer.invoke('fx:install-update'),
  openUpdatesPage: () => ipcRenderer.invoke('fx:open-updates-page'),
};

contextBridge.exposeInMainWorld('fxBrowser', bridgeApi);
contextBridge.exposeInMainWorld('electronAPI', bridgeApi);
