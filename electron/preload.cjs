'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  resizeToHeight: (h) => ipcRenderer.send('resize-to-height', h),
});
