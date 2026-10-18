// preload.cjs - the only bridge between the page and the file logic.
// Sandboxed preloads must be CommonJS, hence .cjs.
const { contextBridge, ipcRenderer } = require('electron');

const call = (name) => (...args) => ipcRenderer.invoke('fm:' + name, ...args);
const isWin = process.platform === 'win32';

contextBridge.exposeInMainWorld('fm', {
  validate: call('validate'),
  info: call('info'),
  exists: call('exists'),
  list: call('list'),
  create: call('create'),
  read: call('read'),
  append: call('append'),
  rename: call('rename'),
  delete: call('delete'),
  pickFolder: call('pickFolder'),
  drives: call('drives'),
  startDir: call('startDir'),
  sep: isWin ? '\\' : '/',
  crlf: isWin,
});
