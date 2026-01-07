import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import nodemailer from 'nodemailer';
import Store from 'electron-store';
import fs from 'node:fs';
import keytar from 'keytar';
import { autoUpdater } from 'electron-updater';

// Database imports
import { 
  initDatabase, 
  closeDatabase, 
  templateOperations, 
  emailHistoryOperations,
  userEmailOperations,
} from './database';
import { extractPdfData } from './pdf-parser';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize electron-store for persisting SMTP settings
const store = new Store();

type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
};

const SMTP_STORE_KEY = 'smtpSettings';
const KEYTAR_SERVICE = 'dentklarEmailer.smtp';
const normalizeAccount = (user: unknown): string => String(user ?? '').trim().toLowerCase();

async function setSmtpPassword(user: string, password: string) {
  const account = normalizeAccount(user);
  if (!account) throw new Error('SMTP user is required to store password');
  await keytar.setPassword(KEYTAR_SERVICE, account, password);
}

async function getSmtpPassword(user: string): Promise<string | null> {
  const account = normalizeAccount(user);
  if (!account) return null;
  return keytar.getPassword(KEYTAR_SERVICE, account);
}

async function deleteSmtpPassword(user: string): Promise<boolean> {
  const account = normalizeAccount(user);
  if (!account) return false;
  return keytar.deletePassword(KEYTAR_SERVICE, account);
}

function getStoredSmtpSettings(): Omit<SmtpSettings, 'password'> {
  const settings = store.get(SMTP_STORE_KEY, {
    host: '',
    port: 587,
    secure: false,
    user: '',
  }) as any;

  return {
    host: String(settings.host ?? ''),
    port: Number(settings.port ?? 587),
    secure: Boolean(settings.secure ?? false),
    user: String(settings.user ?? ''),
  };
}

const isMac = process.platform === 'darwin';

// Create hidden menu for keyboard shortcuts (copy/paste) without visible menu bar
if (isMac) {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
} else {
  Menu.setApplicationMenu(null);
}

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let templateWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window (hidden initially to prevent flash)
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    autoHideMenuBar: true,
    show: false, // Don't show until ready
    backgroundColor: '#f5f7fa', // Match app background to prevent flash
    icon: path.join(process.cwd(), 'img', 'dlogo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Create window first for faster perceived startup
  createWindow();
  // Initialize database in background (non-blocking for UI)
  setImmediate(() => {
    initDatabase();
  });

  // Auto-updater setup - only in packaged app
  if (app.isPackaged) {
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
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Close database on app quit
app.on('before-quit', () => {
  closeDatabase();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// IPC Handlers
ipcMain.handle('save-smtp-settings', async (_, settings) => {
  try {
    const nextSettings: Omit<SmtpSettings, 'password'> = {
      host: String(settings?.host ?? ''),
      port: Number(settings?.port ?? 587),
      secure: Boolean(settings?.secure ?? false),
      user: String(settings?.user ?? ''),
    };

    // If user changed, remove old stored password to avoid orphaned secrets.
    const previous = getStoredSmtpSettings();
    if (previous.user && normalizeAccount(previous.user) !== normalizeAccount(nextSettings.user)) {
      await deleteSmtpPassword(previous.user);
    }

    store.set(SMTP_STORE_KEY, nextSettings);

    const password = String(settings?.password ?? '');
    if (password) {
      await setSmtpPassword(nextSettings.user, password);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-smtp-settings', async () => {
  try {
    const settings = getStoredSmtpSettings();
    // Return empty password; UI should not display stored secret.
    return { success: true, settings: { ...settings, password: '' } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-smtp-connection', async (_, settings) => {
  try {
    const user = String(settings?.user ?? '');
    const pass = String(settings?.password ?? '') || (await getSmtpPassword(user)) || '';

    const transporter = nodemailer.createTransport({
      host: String(settings?.host ?? ''),
      port: Number(settings?.port ?? 587),
      secure: Boolean(settings?.secure ?? false),
      auth: {
        user,
        pass,
      },
    });

    await transporter.verify();
    return { success: true, message: 'SMTP connection successful!' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-email', async (_, emailData) => {
  let pdfData: Buffer | null = null;
  let pdfFilename: string | null = null;

  try {
    const settings = getStoredSmtpSettings();
    const password = (await getSmtpPassword(settings.user)) ?? '';
    
    if (!settings || !settings.host) {
      throw new Error('SMTP settings not configured. Please configure in Settings.');
    }

    if (!password) {
      throw new Error('SMTP password not set. Please enter it in Settings.');
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: password,
      },
    });

    // Read PDF data for storage if provided
    if (emailData.pdfPath) {
      pdfData = fs.readFileSync(emailData.pdfPath);
      pdfFilename = path.basename(emailData.pdfPath);
    }

    const subject = emailData.subject || `Message from ${emailData.name}`;
    const mailOptions: any = {
      from: settings.user,
      to: emailData.recipientEmail,
      subject: subject,
      text: emailData.message,
      html: `
        <h3>Message from DentKlar</h3>
        <p>${emailData.message.replace(/\n/g, '<br>')}</p>
      `,
    };

    // Attach PDF if provided
    if (emailData.pdfPath) {
      mailOptions.attachments = [
        {
          filename: path.basename(emailData.pdfPath),
          path: emailData.pdfPath,
        },
      ];
    }

    await transporter.sendMail(mailOptions);

    // Save to email history
    emailHistoryOperations.create({
      template_id: emailData.templateId || null,
      recipient_name: emailData.name,
      recipient_email: emailData.recipientEmail,
      subject: subject,
      message: emailData.message,
      pdf_filename: pdfFilename,
      pdf_data: pdfData,
      status: 'sent',
      error_message: null
    });

    return { success: true, message: 'Email sent successfully!' };
  } catch (error) {
    // Save failed email to history
    emailHistoryOperations.create({
      template_id: emailData.templateId || null,
      recipient_name: emailData.name || '',
      recipient_email: emailData.recipientEmail || '',
      subject: emailData.subject || `Message from ${emailData.name}`,
      message: emailData.message || '',
      pdf_filename: pdfFilename,
      pdf_data: pdfData,
      status: 'failed',
      error_message: error.message
    });

    return { success: false, error: error.message };
  }
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
  } catch (error) {
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
  } catch (error) {
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

// Helper function to notify all windows about template updates
function notifyTemplatesUpdated() {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('templates-updated');
  });
}

// Template IPC Handlers
ipcMain.handle('get-templates', async () => {
  try {
    const templates = templateOperations.getAll();
    return { success: true, templates };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-template', async (_, id: number) => {
  try {
    const template = templateOperations.getById(id);
    return { success: true, template };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-default-template', async () => {
  try {
    const template = templateOperations.getDefault();
    return { success: true, template };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-template', async (_, templateData) => {
  try {
    const template = templateOperations.create(templateData);
    notifyTemplatesUpdated();
    return { success: true, template };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-template', async (_, id: number, templateData) => {
  try {
    const template = templateOperations.update(id, templateData);
    notifyTemplatesUpdated();
    return { success: true, template };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-template', async (_, id: number) => {
  try {
    const result = templateOperations.delete(id);
    notifyTemplatesUpdated();
    return { success: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-default-template', async (_, id: number) => {
  try {
    const result = templateOperations.setDefault(id);
    notifyTemplatesUpdated();
    return { success: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Email History IPC Handlers
ipcMain.handle('get-email-history', async (_, limit?: number, offset?: number) => {
  try {
    const history = emailHistoryOperations.getAll(limit, offset);
    return { success: true, history };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// NOTE: Sending emails already writes to history in `send-email`.
// This endpoint is intentionally limited to manual/imported history entries to avoid duplicates.
ipcMain.handle('save-email-history', async (_, emailData) => {
  try {
    if (emailData?.source !== 'import') {
      return {
        success: false,
        error: "Direct history saves are disabled. Use 'send-email' (automatic history) or provide { source: 'import' }.",
      };
    }

    // Read PDF data if path is provided
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
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search-email-history', async (_, query: string) => {
  try {
    const history = emailHistoryOperations.search(query);
    return { success: true, history };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-email-stats', async () => {
  try {
    const stats = emailHistoryOperations.getStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-email-history', async (_, id: number) => {
  try {
    const result = emailHistoryOperations.delete(id);
    return { success: result };
  } catch (error) {
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

    // Save PDF to temp directory
    const tempDir = app.getPath('temp');
    const tempFilePath = path.join(tempDir, `email-attachment-${Date.now()}-${email.pdf_filename}`);
    
    fs.writeFileSync(tempFilePath, email.pdf_data);
    
    return { 
      success: true, 
      filePath: tempFilePath,
      filename: email.pdf_filename
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// User Email IPC Handlers
ipcMain.handle('get-user-email-by-name', async (_, name: string) => {
  try {
    const userEmail = userEmailOperations.getByName(name);
    return { success: true, userEmail };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-user-emails', async () => {
  try {
    const userEmails = userEmailOperations.getAll();
    return { success: true, userEmails };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-user-email', async (_, name: string, email: string) => {
  try {
    const userEmail = userEmailOperations.upsert(name, email);
    return { success: true, userEmail };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search-user-emails', async (_, query: string) => {
  try {
    const userEmails = userEmailOperations.search(query);
    return { success: true, userEmails };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-user-email', async (_, id: number) => {
  try {
    const result = userEmailOperations.delete(id);
    return { success: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Auto-update IPC Handlers
ipcMain.handle('check-for-updates', async () => {
  if (app.isPackaged) {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, result };
    } catch (error) {
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
