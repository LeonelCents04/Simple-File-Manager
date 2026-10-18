// fs_scan.js - list a directory into sorted entries. No UI.

import fs from 'node:fs';
import path from 'node:path';
import { ok, fromError, result, FM } from './status.js';

// shortcut: Node cannot read the Windows "hidden" attribute without a native module,
// so hidden/system entries are recognised by name; upgrade if a "show hidden" toggle is added.
const HIDDEN = /^(\.|\$)|^(desktop\.ini|thumbs\.db|system volume information|pagefile\.sys|hiberfil\.sys|swapfile\.sys|dumpstack\.log(\.tmp)?)$/i;

/** Waits for p, but gives up after ms (a disconnected network drive can hang for seconds). */
function withTimeout(p, ms) {
  let timer;
  const t = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

/** Drives that are ready right now, with their size. Windows: A:\ to Z:\; elsewhere just "/".
 *  An empty card reader or DVD drive fails statfs, so it is left out.
 *  @returns FmResult<{path,label,total,free}[]> */
export async function fs_drives() {
  const roots = process.platform === 'win32' ? [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((l) => l + ':\\') : ['/'];
  const probe = async (root) => {
    try {
      const s = await withTimeout(fs.promises.statfs(root), 1500);
      return { path: root, label: root.length > 1 ? root.slice(0, -1) : root, total: s.blocks * s.bsize, free: s.bavail * s.bsize };
    } catch {
      return null;
    }
  };
  return ok((await Promise.all(roots.map(probe))).filter(Boolean));
}

/** @returns FmResult<{name,size,mtimeMs,isDir,isReadOnly}[]> folders first, then files, A-Z ignoring case. */
export function fs_list(dir) {
  if (typeof dir !== 'string' || !dir) return result(FM.INVALID_ARG);
  let dirents;
  try {
    dirents = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return fromError(err);
  }
  const entries = [];
  for (const d of dirents) {
    if (HIDDEN.test(d.name)) continue;
    const e = { name: d.name, size: 0, mtimeMs: 0, isDir: d.isDirectory(), isReadOnly: false };
    try {
      const st = fs.statSync(path.join(dir, d.name));
      e.size = st.isDirectory() ? 0 : st.size;
      e.mtimeMs = st.mtimeMs;
      e.isDir = st.isDirectory();
      e.isReadOnly = (st.mode & 0o200) === 0;
    } catch { /* entries stat cannot read are still listed, with size 0 */ }
    entries.push(e);
  }
  entries.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
  return ok(entries);
}
