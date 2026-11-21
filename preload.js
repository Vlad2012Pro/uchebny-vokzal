const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rail', {
  cfg: () => ipcRenderer.invoke('cfg:get'),
  pick: () => ipcRenderer.invoke('folder:pick'),
  clear: () => ipcRenderer.invoke('folder:clear'),
  open: () => ipcRenderer.invoke('folder:open'),
  list: () => ipcRenderer.invoke('notes:list'),
  write: (f, t) => ipcRenderer.invoke('notes:write', f, t),
  rename: (a, b) => ipcRenderer.invoke('notes:rename', a, b),
  remove: (f) => ipcRenderer.invoke('notes:remove', f)
});
