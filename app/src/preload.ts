import { contextBridge, ipcRenderer, webUtils } from 'electron';

const api: Api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:set', s),
  pickImage: (current) => ipcRenderer.invoke('image:pick', current),
  pathForFile: (file) => webUtils.getPathForFile(file),
  probe: (file) => ipcRenderer.invoke('image:probe', file),
  process: (request) => ipcRenderer.invoke('image:process', request),
  showInFolder: (path) => ipcRenderer.invoke('file:show', path),
};

contextBridge.exposeInMainWorld('api', api);
