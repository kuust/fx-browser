import { contextBridge, ipcRenderer } from 'electron';

const bridgeApi = {
  listEnvironments: () => ipcRenderer.invoke('fx:list-environments'),
  getLastImportSummary: () => ipcRenderer.invoke('fx:get-last-import-summary'),
  importMoreLoginFile: () => ipcRenderer.invoke('fx:import-morelogin-file'),
  startEnvironment: (environmentId: string) => ipcRenderer.invoke('fx:start-environment', environmentId),
  stopEnvironment: (environmentId: string) => ipcRenderer.invoke('fx:stop-environment', environmentId),
  checkProxy: (environmentId: string) => ipcRenderer.invoke('fx:check-proxy', environmentId),
  resetCookieImport: (environmentId: string) => ipcRenderer.invoke('fx:reset-cookie-import', environmentId),
  listProxies: () => ipcRenderer.invoke('fx:list-proxies'),
  saveProxies: (proxies: unknown) => ipcRenderer.invoke('fx:save-proxies', proxies),
  getEnvironmentDraft: () => ipcRenderer.invoke('fx:get-environment-draft'),
  saveEnvironmentDraft: (draft: unknown) => ipcRenderer.invoke('fx:save-environment-draft', draft),
  checkForUpdates: () => ipcRenderer.invoke('fx:check-for-updates'),
  openUpdatesPage: () => ipcRenderer.invoke('fx:open-updates-page'),
};

contextBridge.exposeInMainWorld('fxBrowser', bridgeApi);
contextBridge.exposeInMainWorld('electronAPI', bridgeApi);
