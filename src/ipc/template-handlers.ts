import { ipcMain } from 'electron';
import { templateOperations } from '../database';
import { notifyAllWindows } from '../window/window-manager';

export function registerTemplateHandlers(): void {
  ipcMain.handle('get-templates', async () => {
    try {
      const templates = templateOperations.getAll();
      return { success: true, templates };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-template', async (_, id: number) => {
    try {
      const template = templateOperations.getById(id);
      return { success: true, template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-default-template', async () => {
    try {
      const template = templateOperations.getDefault();
      return { success: true, template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('create-template', async (_, templateData) => {
    try {
      const template = templateOperations.create(templateData);
      notifyAllWindows('templates-updated');
      return { success: true, template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-template', async (_, id: number, templateData) => {
    try {
      const template = templateOperations.update(id, templateData);
      notifyAllWindows('templates-updated');
      return { success: true, template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-template', async (_, id: number) => {
    try {
      const result = templateOperations.delete(id);
      notifyAllWindows('templates-updated');
      return { success: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-default-template', async (_, id: number) => {
    try {
      const result = templateOperations.setDefault(id);
      notifyAllWindows('templates-updated');
      return { success: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
