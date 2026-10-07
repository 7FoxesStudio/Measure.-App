'use strict';
// Exposes a tiny, read-only bridge so the page can ask which monitor it is on.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('measureDesktop', {
  getDisplayInfo: () => ipcRenderer.invoke('ruler:get-display-info'),
  rescan: () => ipcRenderer.invoke('ruler:rescan'),
  onDisplayChanged: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('ruler:display-changed', handler);
    return () => ipcRenderer.removeListener('ruler:display-changed', handler);
  }
});
