// status.js - result codes and the one place that maps system errors to them.

export const FM = Object.freeze({
  OK: 'FM_OK',
  INVALID_ARG: 'FM_ERR_INVALID_ARG',
  INVALID_NAME: 'FM_ERR_INVALID_NAME',
  PATH_TOO_LONG: 'FM_ERR_PATH_TOO_LONG',
  NOT_FOUND: 'FM_ERR_NOT_FOUND',
  EXISTS: 'FM_ERR_EXISTS',
  PERMISSION: 'FM_ERR_PERMISSION',
  IS_DIR: 'FM_ERR_IS_DIR',
  NOT_REGULAR: 'FM_ERR_NOT_REGULAR',
  TOO_LARGE: 'FM_ERR_TOO_LARGE',
  BINARY: 'FM_ERR_BINARY',
  NO_SPACE: 'FM_ERR_NO_SPACE',
  CROSS_DEVICE: 'FM_ERR_CROSS_DEVICE',
  IO: 'FM_ERR_IO',
  CANCELLED: 'FM_ERR_CANCELLED',
});

/** @returns {{code:string, sysErrno:string|null, detail?:string, data?:any}} */
export function result(code, sysErrno = null, extra = {}) {
  return { code, sysErrno, ...extra };
}

export const ok = (data) => result(FM.OK, null, data === undefined ? {} : { data });

export function statusFromErrno(code) {
  switch (code) {
    case 'ENOENT': case 'ENOTDIR': return FM.NOT_FOUND;
    case 'EEXIST': return FM.EXISTS;
    case 'EACCES': case 'EPERM': case 'EROFS': return FM.PERMISSION;
    case 'EISDIR': return FM.IS_DIR;
    case 'ENOSPC': case 'EDQUOT': return FM.NO_SPACE;
    case 'EXDEV': return FM.CROSS_DEVICE;
    case 'ENAMETOOLONG': return FM.PATH_TOO_LONG;
    default: return FM.IO;
  }
}

/** Turns a caught Node error into a result, keeping the raw code for the log panel. */
export function fromError(err) {
  const code = (err && err.code) || 'EUNKNOWN';
  return result(statusFromErrno(code), code);
}
