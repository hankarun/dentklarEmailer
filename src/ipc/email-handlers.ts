import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { sendEmail } from '../services/email-service';
import { extractPdfData } from '../pdf-parser';
import { emailHistoryOperations } from '../database';

export function registerEmailHandlers(): void {
  ipcMain.handle('send-email', async (_, emailData) => {
    return sendEmail(emailData);
  });

  ipcMain.handle('select-pdf', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (result.canceled) {
        return { success: false };
      }

      return { success: true, filePath: result.filePaths[0] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('select-multiple-pdfs', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (result.canceled) {
        return { success: false };
      }

      return { success: true, filePaths: result.filePaths };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('extract-pdf-data', async (_, filePath: string) => {
    return extractPdfData(filePath);
  });

  ipcMain.on('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  // Email History Handlers
  ipcMain.handle('get-email-history', async (_, limit?: number, offset?: number) => {
    try {
      const history = emailHistoryOperations.getAll(limit, offset);
      return { success: true, history };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-email-history', async (_, emailData) => {
    try {
      if (emailData?.source !== 'import') {
        return {
          success: false,
          error: "Direct history saves are disabled. Use 'send-email' (automatic history) or provide { source: 'import' }.",
        };
      }

      let pdfData: Buffer | null = null;
      let pdfFilename: string | null = null;
      
      if (emailData.pdfPath) {
        pdfData = fs.readFileSync(emailData.pdfPath);
        pdfFilename = path.basename(emailData.pdfPath);
      }

      const historyEntry = emailHistoryOperations.create({
        template_id: emailData.templateId || null,
        recipient_name: emailData.name,
        recipient_email: emailData.recipientEmail,
        subject: emailData.subject || `Message from ${emailData.name}`,
        message: emailData.message,
        pdf_filename: pdfFilename,
        pdf_data: pdfData,
        status: emailData.status || 'sent',
        error_message: emailData.errorMessage || null
      });

      return { success: true, entry: historyEntry };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('search-email-history', async (_, query: string) => {
    try {
      const history = emailHistoryOperations.search(query);
      return { success: true, history };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-email-stats', async () => {
    try {
      const stats = emailHistoryOperations.getStats();
      return { success: true, stats };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-email-history', async (_, id: number) => {
    try {
      const result = emailHistoryOperations.delete(id);
      return { success: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-email-pdf', async (_, id: number) => {
    try {
      const email = emailHistoryOperations.getById(id);
      if (!email) {
        return { success: false, error: 'Email not found' };
      }
      
      if (!email.pdf_data || !email.pdf_filename) {
        return { success: false, error: 'No PDF attached to this email' };
      }

      const tempDir = app.getPath('temp');
      const tempFilePath = path.join(tempDir, `email-attachment-${Date.now()}-${email.pdf_filename}`);
      
      fs.writeFileSync(tempFilePath, email.pdf_data);
      
      return { 
        success: true, 
        filePath: tempFilePath,
        filename: email.pdf_filename
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
