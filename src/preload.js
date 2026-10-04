// Schmale Brücke zur Oberfläche: nur diese Funktionen sind im Fenster sichtbar
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ethosDesktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: s => ipcRenderer.invoke('settings:set', s),
  pickFolder: current => ipcRenderer.invoke('dialog:folder', current),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  ejectSender: () => ipcRenderer.invoke('sender:eject'),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  onSync: cb => ipcRenderer.on('sync:status', (_, s) => cb(s)),
  listArchive: () => ipcRenderer.invoke('archive:list'),
  saveToArchive: (name, bytes) => ipcRenderer.invoke('archive:save', name, bytes),
  openArchive: () => ipcRenderer.invoke('archive:open'),
  readFile: p => ipcRenderer.invoke('file:read', p),
  peekFile: (p, n) => ipcRenderer.invoke('file:peek', p, n),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  onUpdate: cb => ipcRenderer.on('update', (_, u) => cb(u)),
  openUpdate: url => ipcRenderer.invoke('update:open', url),
});
