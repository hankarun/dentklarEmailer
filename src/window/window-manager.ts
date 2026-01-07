import { BrowserWindow } from 'electron';
import path from 'node:path';

export let mainWindow: BrowserWindow | null = null;
export let settingsWindow: BrowserWindow | null = null;
export let templateWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
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

  return mainWindow;
}

export function notifyAllWindows(channel: string, ...args: any[]): void {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send(channel, ...args);
  });
}
