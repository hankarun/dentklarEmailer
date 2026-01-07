import { ipcMain } from 'electron';
import { saveSmtpSettings, getStoredSmtpSettings } from '../services/smtp-service';
import { testSmtpConnection } from '../services/email-service';

export function registerSmtpHandlers(): void {
  ipcMain.handle('save-smtp-settings', async (_, settings) => {
    try {
      await saveSmtpSettings(settings);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-smtp-settings', async () => {
    try {
      const settings = getStoredSmtpSettings();
      // Return empty password; UI should not display stored secret.
      return { success: true, settings: { ...settings, password: '' } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('test-smtp-connection', async (_, settings) => {
    return testSmtpConnection(settings);
  });
}
