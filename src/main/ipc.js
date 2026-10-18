// ipc.js - one handler per file operation. Checks argument types, calls file_ops,
// returns the FmResult as plain JSON. Handlers never throw to the renderer.

import { app, dialog, ipcMain, BrowserWindow } from 'electron';
import fs from 'node:fs';
import { FM, result, ok } from './status.js';
import { fm_get_info, fm_exists, fm_create, fm_read, fm_append, fm_rename, fm_delete, READ_LIMIT } from './file_ops.js';
import { fs_list, fs_drives } from './fs_scan.js';
import { fm_resolve_input } from './validate.js';
import { pathParent, pathSegments, isRoot } from './util.js';

const isStr = (x) => typeof x === 'string' && x.length > 0;
const badArg = () => result(FM.INVALID_ARG);

/** Folder named on the command line (npm start -- D:\some\folder), if any. */
function argDir() {
  for (const a of process.argv.slice(app.isPackaged ? 1 : 2)) {
    if (a.startsWith('-') || a === '.') continue;
    try {
      if (fs.statSync(a).isDirectory()) return a;
    } catch { /* not a folder */ }
  }
  return null;
}

const handlers = {
  validate: (input, base) => (typeof input === 'string' && isStr(base) ? fm_resolve_input(input, base) : badArg()),
  info: (p) => (isStr(p) ? fm_get_info(p) : badArg()),
  exists: (p) => isStr(p) && fm_exists(p),
  list: (dir) => {
    if (!isStr(dir)) return badArg();
    const r = fs_list(dir);
    if (r.code !== FM.OK) return r;
    return ok({ entries: r.data, segments: pathSegments(dir), parent: isRoot(dir) ? null : pathParent(dir) });
  },
  create: (p, content) => (isStr(p) && typeof content === 'string' ? fm_create(p, content) : badArg()),
  read: (p, max) => (isStr(p) && (max === undefined || Number.isInteger(max)) ? fm_read(p, Math.min(max || READ_LIMIT, READ_LIMIT)) : badArg()),
  append: (p, content) => (isStr(p) && typeof content === 'string' ? fm_append(p, content) : badArg()),
  rename: (a, b) => (isStr(a) && isStr(b) ? fm_rename(a, b) : badArg()),
  delete: (p) => (isStr(p) ? fm_delete(p) : badArg()),
  drives: () => fs_drives(),
  startDir: () => ({ dir: argDir() || app.getPath('documents'), explicit: argDir() !== null }),
  pickFolder: async (e) => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openDirectory'] });
    return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
  },
};

export function registerIpc() {
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle('fm:' + name, async (e, ...args) => {
      try {
        return name === 'pickFolder' ? await fn(e) : await fn(...args);
      } catch (err) {
        // file_ops never throws; this only guards the glue code.
        return result(FM.IO, (err && err.code) || 'EUNKNOWN');
      }
    });
  }
}
