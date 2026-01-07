import { Menu, app } from 'electron';

const isMac = process.platform === 'darwin';

export function setupApplicationMenu(): void {
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
}
