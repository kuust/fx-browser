import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fxBrowser', {
  listEnvironments: () => ipcRenderer.invoke('fx:list-environments'),
  getLastImportSummary: () => ipcRenderer.invoke('fx:get-last-import-summary'),
  importMoreLoginFile: () => ipcRenderer.invoke('fx:import-morelogin-file'),
});
