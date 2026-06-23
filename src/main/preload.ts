import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fxBrowser', {
  parseMoreLoginText: (text: string) => ipcRenderer.invoke('fx:parse-morelogin-text', text),
});
