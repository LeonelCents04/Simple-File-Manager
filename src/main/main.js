// main.js - window, lifecycle, single instance.

import { app, BrowserWindow, Menu, nativeTheme } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from './ipc.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1290, height: 850, minWidth: 900, minHeight: 580, useContentSize: true,
    title: 'Files',
    icon: path.join(here, '..', 'renderer', 'icon.png'),   // built by scripts/make-icon.ps1
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#080c1c' : '#eaf0ff',
    // The page draws the glass window; the real min/max/close buttons sit on top of it.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#8890b0', height: 34 },
    webPreferences: {
      preload: path.join(here, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(here, '..', 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);   // the page has its own File / Go / Help menus
    registerIpc();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
