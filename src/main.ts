import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import nodemailer from 'nodemailer';
import Store from 'electron-store';
import fs from 'node:fs';
const pdfParse = require('pdf-parse');

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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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

    const mailOptions: any = {
      from: settings.user,
      to: emailData.recipientEmail,
      subject: `Message from ${emailData.name}`,
      text: emailData.message,
      html: `
        <h3>Message from ${emailData.name}</h3>
        <p><strong>Email:</strong> ${emailData.email}</p>
        <p><strong>Message:</strong></p>
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
    return { success: true, message: 'Email sent successfully!' };
  } catch (error) {
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
    let article = '';
    
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
          article = line;
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
        article: article,
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
