import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import nodemailer from 'nodemailer';
import Store from 'electron-store';
import fs from 'node:fs';
const pdfParse = require('pdf-parse');

// Database imports
import { 
  initDatabase, 
  closeDatabase, 
  templateOperations, 
  emailHistoryOperations,
  Template 
} from './database';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize electron-store for persisting SMTP settings
const store = new Store();

const isMac = process.platform === 'darwin';

const template: Electron.MenuItemConstructorOptions[] = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        } as Electron.MenuItemConstructorOptions,
      ]
    : []),
  {
    label: 'File',
    submenu: [isMac ? { role: 'close' } : { role: 'quit' }] as Electron.MenuItemConstructorOptions[],
  },
  {
    label: 'Settings',
    submenu: [
      {
        label: 'Preferences',
        accelerator: isMac ? 'Cmd+,' : 'Ctrl+,',
        click: () => {
          createSettingsWindow();
        },
      },
      {
        label: 'Edit Templates',
        accelerator: isMac ? 'Cmd+T' : 'Ctrl+T',
        click: () => {
          createTemplateWindow();
        },
      },
    ],
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          await shell.openExternal('https://electronjs.org');
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let templateWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
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
  mainWindow.webContents.openDevTools();
};

const createSettingsWindow = () => {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    title: 'SMTP Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    parent: mainWindow,
    modal: true,
  });

  // Load settings page
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?page=settings`);
  } else {
    settingsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { query: { page: 'settings' } }
    );
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
};

const createTemplateWindow = () => {
  if (templateWindow) {
    templateWindow.focus();
    return;
  }

  templateWindow = new BrowserWindow({
    width: 800,
    height: 700,
    title: 'Edit Templates',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    parent: mainWindow,
  });

  // Load template editor page
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    templateWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?page=templates`);
  } else {
    templateWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { query: { page: 'templates' } }
    );
  }

  templateWindow.on('closed', () => {
    templateWindow = null;
    // Notify main window to refresh templates
    if (mainWindow) {
      mainWindow.webContents.send('templates-updated');
    }
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Initialize database
  initDatabase();
  createWindow();
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
    store.set('smtpSettings', settings);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-smtp-settings', async () => {
  try {
    const settings = store.get('smtpSettings', {
      host: '',
      port: 587,
      secure: false,
      user: '',
      password: ''
    });
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-smtp-connection', async (_, settings) => {
  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.password,
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
    const settings = store.get('smtpSettings') as any;
    
    if (!settings || !settings.host) {
      throw new Error('SMTP settings not configured. Please configure in Settings.');
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.password,
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

ipcMain.handle('extract-pdf-data', async (_, filePath: string) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;

    // Search for the marker text
    const marker = 'ZÄ Turan & Kaganaslan, Nassauische Str. 30, 10717 Berlin';
    const markerIndex = text.indexOf(marker);

    if (markerIndex === -1) {
      return { 
        success: false, 
        error: 'Marker text not found in PDF' 
      };
    }

    // Extract text after the marker
    const textAfterMarker = text.substring(markerIndex + marker.length);
    
    // Extract the next few lines after the marker
    const lines = textAfterMarker.split('\n').filter(line => line.trim().length > 0);
    
    let name = '';
    let anrede = '';
    
    // Based on the actual PDF structure:
    // After marker we have: Herrn, then name, then address
    // Look for "Herrn" or similar titles, then extract the name on next line
    if (lines.length > 0) {
      // Find the line after "Herrn" or similar title
      let nameLineIndex = 0;
      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i].trim();
        // Check if this line is a title (Herrn, Frau, etc.)
        if (line.match(/^(Herrn|Herr|Frau|Dr\.|Prof\.)$/i)) {
          // Normalize "Herrn" (accusative) to "Herr" (nominative)
          if (line.toLowerCase() === 'herrn') {
            anrede = 'Herr';
          } else {
            anrede = line.charAt(0).toUpperCase() + line.slice(1).toLowerCase();
          }
          nameLineIndex = i + 1;
          break;
        } else if (i === 0) {
          // If first line is not a title, it might be the name directly
          nameLineIndex = 0;
        }
      }
      
      // Extract the name
      if (lines[nameLineIndex]) {
        name = lines[nameLineIndex].trim();
      }
    }

    return { 
      success: true, 
      data: {
        name: name,
        anrede: anrede,
        extractedText: lines.slice(0, 5).join('\n') // Return first 5 lines for debugging
      }
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
});

ipcMain.on('close-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.close();
});

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
    return { success: true, template };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-template', async (_, id: number, templateData) => {
  try {
    const template = templateOperations.update(id, templateData);
    return { success: true, template };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-template', async (_, id: number) => {
  try {
    const result = templateOperations.delete(id);
    return { success: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-default-template', async (_, id: number) => {
  try {
    const result = templateOperations.setDefault(id);
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

ipcMain.handle('save-email-history', async (_, emailData) => {
  try {
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
