import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isInternalUrl, windowKey } from './windows.js';

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const menuUrl = pathToFileURL(path.join(appRoot, 'index.html')).href;
const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';

const webPreferences = {
  autoplayPolicy: 'no-user-gesture-required', // áudio toca sem clique prévio
  contextIsolation: true,
  nodeIntegration: false,
};

const instrumentWindows = new Map(); // windowKey -> BrowserWindow
let menuWindow = null;

function attach(win) {
  // Qualquer link/popup: instrumento interno vira janela própria (ou foca a existente); o resto é negado.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url, appRoot)) openInstrument(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url, appRoot)) event.preventDefault();
  });
}

function openInstrument(url) {
  const key = windowKey(url);
  const existing = instrumentWindows.get(key);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return;
  }
  const win = new BrowserWindow({ width: 1200, height: 800, backgroundColor: '#1b1d20', webPreferences });
  instrumentWindows.set(key, win);
  win.on('closed', () => instrumentWindows.delete(key));
  attach(win);
  win.loadURL(url);
}

function openMenu() {
  if (menuWindow && !menuWindow.isDestroyed()) { menuWindow.focus(); return; }
  menuWindow = new BrowserWindow({ width: 960, height: 700, backgroundColor: '#1b1d20', title: 'Sintetizadores', webPreferences });
  menuWindow.on('closed', () => { menuWindow = null; });
  attach(menuWindow);
  menuWindow.loadURL(menuUrl);
}

function buildMenu() {
  const view = [{ role: 'reload' }];
  if (isDev) view.push({ role: 'toggleDevTools' });
  view.push({ role: 'togglefullscreen' });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'Arquivo', submenu: [{ label: 'Menu de instrumentos', accelerator: 'CmdOrCtrl+M', click: openMenu }, isMac ? { role: 'close' } : { role: 'quit' }] },
    { label: 'Ver', submenu: view },
    { role: 'windowMenu' },
  ]));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', openMenu);
  app.whenReady().then(() => {
    buildMenu();
    openMenu();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) openMenu(); });
  });
  app.on('window-all-closed', () => { if (!isMac) app.quit(); });
}
