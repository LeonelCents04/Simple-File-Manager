// validate.js - name and path syntax rules (section 8). Pure: no fs.

import { FM, result, ok } from './status.js';
import { resolveAgainst } from './util.js';

export const PATH_LIMIT = 260;

export const isReservedName = (part) => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(part);

const bad = (detail) => result(FM.INVALID_NAME, null, { detail });

/** Syntax checks only, no disk access. Accepts a name or a relative/absolute path. */
export function fm_validate_path(input) {
  if (typeof input !== 'string') return result(FM.INVALID_ARG, null, { detail: 'The name is empty.' });
  const s = input.replace(/\//g, '\\');
  if (!s.trim()) return bad('The name is empty.');
  if (s.length >= PATH_LIMIT) return result(FM.PATH_TOO_LONG, null, { detail: 'That path is 260 characters or longer.' });

  const parts = s.split('\\');
  for (let i = 0; i < parts.length; i++) {
    const c = parts[i], first = i === 0, last = i === parts.length - 1;
    if (first && /^[A-Za-z]:$/.test(c)) {
      if (last) return bad('A drive is not a file name.');
      continue;
    }
    if (c === '') {
      if (last) return bad('The path ends with "\\", so there is no file name.');
      continue;
    }
    if (c === '.' || c === '..') {
      if (last) return bad('"' + c + '" is not a valid file name.');
      continue;
    }
    if (c.length > 255) return bad('A name part is longer than 255 characters.');
    // eslint-disable-next-line no-control-regex
    const m = c.match(/[<>:"|?*\u0000-\u001f]/);
    if (m) return bad('The character "' + (m[0].charCodeAt(0) < 32 ? 'control code' : m[0]) + '" is not allowed in file names.');
    if (/[ .]$/.test(c)) return bad('Names cannot end with a space or a dot.');
    if (isReservedName(c)) return bad('"' + c + '" is a reserved Windows device name.');
  }
  return ok();
}

/** Validates user input and resolves it against the folder currently shown. */
export function fm_resolve_input(input, base) {
  const v = fm_validate_path(input);
  if (v.code !== FM.OK) return v;
  if (typeof base !== 'string' || !base) return result(FM.INVALID_ARG);
  const full = resolveAgainst(base, input.trim());
  if (full.length >= PATH_LIMIT) return result(FM.PATH_TOO_LONG, null, { detail: 'That path is 260 characters or longer.' });
  return ok({ path: full });
}
