// file_ops.js - create, read, append, rename, delete, exists, info.
//
// Never prints, never touches the UI, never asks the user anything, never throws:
// every function returns an FmResult. Every descriptor is closed in a `finally`,
// and a failed close after a write is reported (data may be lost).

import fs from 'node:fs';
import path from 'node:path';
import { FM, result, ok, fromError } from './status.js';
import { fm_validate_path } from './validate.js';

const { O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_EXCL, O_APPEND } = fs.constants;
const IS_WIN = process.platform === 'win32';
export const READ_LIMIT = 1048576;

// D9: files written on Windows use CRLF so they open correctly in Notepad.
const toDisk = (text) => Buffer.from(IS_WIN ? text.replace(/\r?\n/g, '\r\n') : text, 'utf8');
const isReadOnly = (st) => (Number(st.mode) & 0o200) === 0;
const badArg = () => result(FM.INVALID_ARG);

function checkPath(p) {
  if (typeof p !== 'string' || !p) return badArg();
  return fm_validate_path(p);
}

/** stat without throwing: Stats or null. */
const statOrNull = (p, opts) => fs.statSync(p, { throwIfNoEntry: false, ...opts }) || null;

/** Loops because writeSync may write fewer bytes than asked. */
function writeAll(fd, buf) {
  let off = 0;
  while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off);
}

/** Closes fd; a close failure only replaces a success. */
function closeChecked(fd, r) {
  try {
    fs.closeSync(fd);
  } catch (err) {
    if (r.code === FM.OK) return { ...fromError(err), code: FM.IO };
  }
  return r;
}

function parentCheck(p) {
  const st = statOrNull(path.dirname(p));
  return st && st.isDirectory() ? ok() : result(FM.NOT_FOUND, 'ENOENT');
}

export function fm_exists(p) {
  if (typeof p !== 'string' || !p) return false;
  try {
    return statOrNull(p) !== null;
  } catch {
    return false;
  }
}

/** @returns FmResult<{name,path,size,mtimeMs,isDir,isReadOnly,id}> */
export function fm_get_info(p) {
  if (typeof p !== 'string' || !p) return badArg();
  try {
    const st = fs.statSync(p, { bigint: true });
    return ok({
      name: path.basename(p) || p,
      path: p,
      size: Number(st.size),
      mtimeMs: Number(st.mtimeMs),
      isDir: st.isDirectory(),
      isReadOnly: isReadOnly(st),
      id: st.dev + ':' + st.ino,   // same file check for case-only renames
    });
  } catch (err) {
    return fromError(err);
  }
}

export function fm_create(p, content) {
  if (typeof content !== 'string') return badArg();
  let r = checkPath(p);
  if (r.code !== FM.OK) return r;
  try {
    r = parentCheck(p);
    if (r.code !== FM.OK) return r;
  } catch (err) {
    return fromError(err);
  }

  const buf = toDisk(content);
  let fd;
  try {
    // Create-or-fail in one atomic step: never overwrites, no check-then-create race.
    fd = fs.openSync(p, O_WRONLY | O_CREAT | O_EXCL, 0o666);
  } catch (err) {
    // Windows reports a folder with the same name as EPERM/EACCES/EISDIR.
    if (err.code !== 'EEXIST' && fm_exists(p)) return result(FM.EXISTS, err.code);
    return fromError(err);
  }

  r = ok({ bytes: buf.length });
  try {
    writeAll(fd, buf);
    fs.fsyncSync(fd);
  } catch (err) {
    r = fromError(err);
  } finally {
    r = closeChecked(fd, r);
  }
  if (r.code !== FM.OK) {
    try {
      fs.unlinkSync(p);   // we created it, so we remove the partial file
    } catch { /* the original error is what the user needs to see */ }
  }
  return r;
}

/** @returns FmResult<{text, bytes, size, truncated, looksBinary}> */
export function fm_read(p, maxBytes = READ_LIMIT) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) return badArg();
  let r = checkPath(p);
  if (r.code !== FM.OK) return r;

  let fd;
  try {
    const pre = statOrNull(p);
    if (!pre) return result(FM.NOT_FOUND, 'ENOENT');
    if (pre.isDirectory()) return result(FM.IS_DIR, 'EISDIR');
    fd = fs.openSync(p, O_RDONLY);
  } catch (err) {
    return fromError(err);
  }

  try {
    const st = fs.fstatSync(fd);   // confirm on the open handle, not just the name
    if (!st.isFile()) {
      r = result(st.isDirectory() ? FM.IS_DIR : FM.NOT_REGULAR);
    } else {
      const buf = Buffer.alloc(Math.min(st.size, maxBytes));
      let n = 0, got;
      while (n < buf.length && (got = fs.readSync(fd, buf, n, buf.length - n, n)) > 0) n += got;
      // One byte past the limit tells us whether the file was cut off.
      const truncated = n === maxBytes && fs.readSync(fd, Buffer.alloc(1), 0, 1, n) === 1;
      const bytes = buf.subarray(0, n);
      if (bytes.subarray(0, 512).includes(0)) {
        r = result(FM.BINARY, null, { data: { looksBinary: true } });
      } else {
        r = ok({ text: bytes.toString('utf8').replace(/\r/g, ''), bytes: n, size: st.size, truncated, looksBinary: false });
      }
    }
  } catch (err) {
    r = fromError(err);
  } finally {
    r = closeChecked(fd, r);
  }
  return r;
}

export function fm_append(p, content) {
  if (typeof content !== 'string') return badArg();
  let r = checkPath(p);
  if (r.code !== FM.OK) return r;
  try {
    const st = statOrNull(p);
    if (!st) return result(FM.NOT_FOUND, 'ENOENT');
    if (st.isDirectory()) return result(FM.IS_DIR, 'EISDIR');
    if (!st.isFile()) return result(FM.NOT_REGULAR);
    if (isReadOnly(st)) return result(FM.PERMISSION, 'EACCES');
  } catch (err) {
    return fromError(err);
  }

  let fd;
  try {
    // No O_CREAT: a file deleted since the check fails here instead of being re-created.
    // O_RDWR lets us look at the last byte; writes still go to the end.
    fd = fs.openSync(p, O_RDWR | O_APPEND);
  } catch (err) {
    return fromError(err);
  }

  const body = toDisk(content);
  r = ok({ bytes: body.length });
  let size = -1;
  try {
    size = fs.fstatSync(fd).size;
    const last = Buffer.alloc(1);
    const needNewline = size > 0 && fs.readSync(fd, last, 0, 1, size - 1) === 1 && last[0] !== 0x0a;
    writeAll(fd, needNewline ? Buffer.concat([toDisk('\n'), body]) : body);   // new text starts on its own line
    fs.fsyncSync(fd);
  } catch (err) {
    r = fromError(err);
  } finally {
    r = closeChecked(fd, r);
  }
  // Don't leave half of the new text behind (e.g. disk full): cut back to the old size.
  // By path, because an O_APPEND handle on Windows has no right to shorten the file.
  if (r.code !== FM.OK && size >= 0) {
    try { fs.truncateSync(p, size); } catch { /* the original error is what the user needs to see */ }
  }
  return r;
}

export function fm_rename(oldPath, newPath) {
  let r = checkPath(oldPath);
  if (r.code !== FM.OK) return r;
  r = checkPath(newPath);
  if (r.code !== FM.OK) return r;
  try {
    const src = statOrNull(oldPath, { bigint: true });
    if (!src) return result(FM.NOT_FOUND, 'ENOENT');
    if (oldPath === newPath) return ok({ unchanged: true });
    if (path.parse(oldPath).root.toLowerCase() !== path.parse(newPath).root.toLowerCase()) return result(FM.CROSS_DEVICE, 'EXDEV');
    r = parentCheck(newPath);
    if (r.code !== FM.OK) return r;
    // Node's rename replaces an existing target on every OS, so refuse explicitly.
    // A case-only rename finds the source itself (same dev/ino): allow it.
    // shortcut: tiny gap between this check and renameSync; acceptable for this scope.
    const dst = statOrNull(newPath, { bigint: true });
    if (dst && !(dst.dev === src.dev && dst.ino === src.ino)) return result(FM.EXISTS, 'EEXIST');
    fs.renameSync(oldPath, newPath);
    return ok();
  } catch (err) {
    return fromError(err);
  }
}

export function fm_delete(p) {
  const r = checkPath(p);
  if (r.code !== FM.OK) return r;
  try {
    const lst = fs.lstatSync(p, { throwIfNoEntry: false });
    if (!lst) return result(FM.NOT_FOUND, 'ENOENT');
    if (lst.isDirectory()) return result(FM.IS_DIR, 'EISDIR');
    if (lst.isSymbolicLink()) {
      // A link to a folder counts as a folder; never follow it.
      const target = statOrNull(p);
      if (target && target.isDirectory()) return result(FM.IS_DIR, 'EISDIR');
    } else if (!lst.isFile()) {
      return result(FM.NOT_REGULAR);
    }
    // Checked here because unlink on Windows clears the read-only flag and deletes anyway.
    if (isReadOnly(lst)) return result(FM.PERMISSION, 'EACCES');
    fs.unlinkSync(p);
    return ok();
  } catch (err) {
    return fromError(err);
  }
}
