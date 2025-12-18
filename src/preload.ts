// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // SMTP Settings
  saveSMTPSettings: (settings: any) => ipcRenderer.invoke('save-smtp-settings', settings),
  getSMTPSettings: () => ipcRenderer.invoke('get-smtp-settings'),
  testSMTPConnection: (settings: any) => ipcRenderer.invoke('test-smtp-connection', settings),
  
  // Email
  sendEmail: (emailData: any) => ipcRenderer.invoke('send-email', emailData),
  
  // File selection
  selectPDF: () => ipcRenderer.invoke('select-pdf'),
  
  // PDF extraction
  extractPDFData: (filePath: string) => ipcRenderer.invoke('extract-pdf-data', filePath),
  
  // Window control
  closeWindow: () => ipcRenderer.send('close-window'),
});
