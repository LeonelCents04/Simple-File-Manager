// helpers.js - fresh temp folder per test, cleaned up afterwards.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-test-'));
  t.after(() => {
    // Read-only files would block cleanup on Windows.
    const unlock = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        try { fs.chmodSync(p, 0o666); } catch { /* dangling link */ }
        if (e.isDirectory()) unlock(p);
      }
    };
    try { unlock(dir); } catch { /* best effort */ }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return (...names) => path.join(dir, ...names);
}

export const IS_WIN = process.platform === 'win32';
export const raw = (p) => fs.readFileSync(p, 'utf8');
export const text = (p) => raw(p).replace(/\r/g, '');
