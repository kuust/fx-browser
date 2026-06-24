const { contextBridge, ipcRenderer } = require('electron');

const bridgeApi = {
  listEnvironments: () => ipcRenderer.invoke('fx:list-environments'),
  getLastImportSummary: () => ipcRenderer.invoke('fx:get-last-import-summary'),
  importMoreLoginFile: () => ipcRenderer.invoke('fx:import-morelogin-file'),
  startEnvironment: (environmentId) => ipcRenderer.invoke('fx:start-environment', environmentId),
  stopEnvironment: (environmentId) => ipcRenderer.invoke('fx:stop-environment', environmentId),
  checkProxy: (environmentId) => ipcRenderer.invoke('fx:check-proxy', environmentId),
  resetCookieImport: (environmentId) => ipcRenderer.invoke('fx:reset-cookie-import', environmentId),
};

contextBridge.exposeInMainWorld('fxBrowser', bridgeApi);
contextBridge.exposeInMainWorld('electronAPI', bridgeApi);
