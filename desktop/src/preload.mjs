import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld(
  'nazcaDesktop',
  Object.freeze({
    runtimeInfo: () => ipcRenderer.invoke('desktop:runtime-info'),
    openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
  }),
);
