
import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // App Info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // File path utilities
  getFilePath: (file: File) => {
    const path = webUtils.getPathForFile(file);
    return path;
  },
  
  // SMTP Settings
  saveSMTPSettings: (settings: any) => ipcRenderer.invoke('save-smtp-settings', settings),
  getSMTPSettings: () => ipcRenderer.invoke('get-smtp-settings'),
  testSMTPConnection: (settings: any) => ipcRenderer.invoke('test-smtp-connection', settings),
  
  // Email
  sendEmail: (emailData: any) => ipcRenderer.invoke('send-email', emailData),
  
  // File selection
  selectPDF: () => ipcRenderer.invoke('select-pdf'),
  selectMultiplePDFs: () => ipcRenderer.invoke('select-multiple-pdfs'),
  
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

  // User email operations (store/retrieve emails by name)
  getUserEmailByName: (name: string) => ipcRenderer.invoke('get-user-email-by-name', name),
  getAllUserEmails: () => ipcRenderer.invoke('get-all-user-emails'),
  saveUserEmail: (name: string, email: string) => ipcRenderer.invoke('save-user-email', name, email),
  searchUserEmails: (query: string) => ipcRenderer.invoke('search-user-emails', query),
  deleteUserEmail: (id: number) => ipcRenderer.invoke('delete-user-email', id),

  // Event listeners
  onTemplatesUpdated: (callback: () => void) => {
    ipcRenderer.on('templates-updated', callback);
    return () => ipcRenderer.removeListener('templates-updated', callback);
  },

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on('update-checking', callback);
    return () => ipcRenderer.removeListener('update-checking', callback);
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
    return () => ipcRenderer.removeAllListeners('update-available');
  },
  onUpdateNotAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-not-available', (_, info) => callback(info));
    return () => ipcRenderer.removeAllListeners('update-not-available');
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_, error) => callback(error));
    return () => ipcRenderer.removeAllListeners('update-error');
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('update-download-progress', (_, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners('update-download-progress');
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
    return () => ipcRenderer.removeAllListeners('update-downloaded');
  },
});
