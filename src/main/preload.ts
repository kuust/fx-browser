import { contextBridge, ipcRenderer } from 'electron';

const bridgeApi = {
  listEnvironments: () => ipcRenderer.invoke('fx:list-environments'),
  getLastImportSummary: () => ipcRenderer.invoke('fx:get-last-import-summary'),
  importMoreLoginFile: () => ipcRenderer.invoke('fx:import-morelogin-file'),
  startEnvironment: (environmentId: string) => ipcRenderer.invoke('fx:start-environment', environmentId),
  stopEnvironment: (environmentId: string) => ipcRenderer.invoke('fx:stop-environment', environmentId),
  checkProxy: (environmentId: string) => ipcRenderer.invoke('fx:check-proxy', environmentId),
  resetCookieImport: (environmentId: string) => ipcRenderer.invoke('fx:reset-cookie-import', environmentId),
};

contextBridge.exposeInMainWorld('fxBrowser', bridgeApi);
contextBridge.exposeInMainWorld('electronAPI', bridgeApi);
