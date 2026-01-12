import { ipcMain } from 'electron';
import { signatureOperations } from '../database';
import { notifyAllWindows } from '../window/window-manager';

export function registerSignatureHandlers(): void {
  ipcMain.handle('get-signatures', async () => {
    try {
      const signatures = signatureOperations.getAll();
      return { success: true, signatures };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-signature', async (_, id: number) => {
    try {
      const signature = signatureOperations.getById(id);
      return { success: true, signature };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-default-signature', async () => {
    try {
      const signature = signatureOperations.getDefault();
      return { success: true, signature };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('create-signature', async (_, signatureData) => {
    try {
      const signature = signatureOperations.create(signatureData);
      notifyAllWindows('signatures-updated');
      return { success: true, signature };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-signature', async (_, id: number, signatureData) => {
    try {
      const signature = signatureOperations.update(id, signatureData);
      notifyAllWindows('signatures-updated');
      return { success: true, signature };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-signature', async (_, id: number) => {
    try {
      const result = signatureOperations.delete(id);
      notifyAllWindows('signatures-updated');
      return { success: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-default-signature', async (_, id: number) => {
    try {
      const result = signatureOperations.setDefault(id);
      notifyAllWindows('signatures-updated');
      return { success: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
