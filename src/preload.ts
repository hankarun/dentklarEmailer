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

  // Template operations
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  getTemplate: (id: number) => ipcRenderer.invoke('get-template', id),
  getDefaultTemplate: () => ipcRenderer.invoke('get-default-template'),
  createTemplate: (template: any) => ipcRenderer.invoke('create-template', template),
  updateTemplate: (id: number, template: any) => ipcRenderer.invoke('update-template', id, template),
  deleteTemplate: (id: number) => ipcRenderer.invoke('delete-template', id),
  setDefaultTemplate: (id: number) => ipcRenderer.invoke('set-default-template', id),

  // Email history operations
  getEmailHistory: (limit?: number, offset?: number) => ipcRenderer.invoke('get-email-history', limit, offset),
  saveEmailHistory: (emailData: any) => ipcRenderer.invoke('save-email-history', emailData),
  searchEmailHistory: (query: string) => ipcRenderer.invoke('search-email-history', query),
  getEmailStats: () => ipcRenderer.invoke('get-email-stats'),
  deleteEmailHistory: (id: number) => ipcRenderer.invoke('delete-email-history', id),
  getEmailPdf: (id: number) => ipcRenderer.invoke('get-email-pdf', id),

  // Event listeners
  onTemplatesUpdated: (callback: () => void) => {
    ipcRenderer.on('templates-updated', callback);
    return () => ipcRenderer.removeListener('templates-updated', callback);
  },
});
