import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { initDatabase, closeDatabase } from './database';
import { createMainWindow } from './window/window-manager';
import { setupApplicationMenu } from './menu/menu-config';
import { registerAllIpcHandlers } from './ipc';
import { setupAutoUpdater } from './services/auto-updater-service';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Setup application menu
  setupApplicationMenu();
  
  // Create main window first for faster perceived startup
  createMainWindow();
  
  // Initialize database in background (non-blocking for UI)
  setImmediate(() => {
    initDatabase();
  });

  // Register all IPC handlers
  registerAllIpcHandlers();

  // Setup auto-updater
  setupAutoUpdater();
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Close database on app quit
app.on('before-quit', () => {
  closeDatabase();
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
