import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { mainWindow } from '../window/window-manager';

export function setupAutoUpdater(): void {
  // Auto-updater setup - only in packaged app
  if (!app.isPackaged) {
    return;
  }

  // Configure auto-updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;

  // Log updater events
  autoUpdater.logger = {
    info: (message: any) => console.log('[AutoUpdater]', message),
    warn: (message: any) => console.warn('[AutoUpdater]', message),
    error: (message: any) => console.error('[AutoUpdater]', message),
    debug: (message: any) => console.log('[AutoUpdater Debug]', message),
  };

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
    mainWindow?.webContents.send('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    mainWindow?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Update not available:', info.version);
    mainWindow?.webContents.send('update-not-available', info);
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err);
    mainWindow?.webContents.send('update-error', err.message);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log('[AutoUpdater] Download progress:', progressObj.percent);
    mainWindow?.webContents.send('update-download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    mainWindow?.webContents.send('update-downloaded', info);
  });

  // Check for updates after a short delay to ensure window is ready
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[AutoUpdater] Check for updates failed:', err);
    });
  }, 3000);
}
