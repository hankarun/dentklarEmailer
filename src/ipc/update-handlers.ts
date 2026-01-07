import { ipcMain, app } from 'electron';
import { autoUpdater } from 'electron-updater';

export function registerUpdateHandlers(): void {
  ipcMain.handle('check-for-updates', async () => {
    if (app.isPackaged) {
      try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Updates only available in packaged app' };
  });

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
}
