'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  resizeToHeight:        (h)                    => ipcRenderer.send('resize-to-height', h),
  detectCommunityFolder: (sim)                  => ipcRenderer.invoke('detect-community-folder', sim),
  scanCommunityFolder:   (path)                 => ipcRenderer.invoke('scan-community-folder', path),
  openFolderDialog:      ()                     => ipcRenderer.invoke('open-folder-dialog'),
  savePln:               (content, filename)    => ipcRenderer.invoke('save-pln', { content, filename }),
});
