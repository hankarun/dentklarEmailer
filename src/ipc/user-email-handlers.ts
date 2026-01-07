import { ipcMain } from 'electron';
import { userEmailOperations } from '../database';

export function registerUserEmailHandlers(): void {
  ipcMain.handle('get-user-email-by-name', async (_, name: string) => {
    try {
      const userEmail = userEmailOperations.getByName(name);
      return { success: true, userEmail };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-all-user-emails', async () => {
    try {
      const userEmails = userEmailOperations.getAll();
      return { success: true, userEmails };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-user-email', async (_, name: string, email: string) => {
    try {
      const userEmail = userEmailOperations.upsert(name, email);
      return { success: true, userEmail };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('search-user-emails', async (_, query: string) => {
    try {
      const userEmails = userEmailOperations.search(query);
      return { success: true, userEmails };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-user-email', async (_, id: number) => {
    try {
      const result = userEmailOperations.delete(id);
      return { success: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
