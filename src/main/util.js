// util.js - path helpers (main process only; the renderer never sees `path`).

import path from 'node:path';

export { formatSize, formatModified, byteLength } from '../shared/format.js';

export const pathJoin = (base, name) => path.join(base, name);

/** Parent folder; a root ("D:\") is its own parent. */
export const pathParent = (p) => path.dirname(p);

export const isRoot = (p) => path.parse(p).root.toLowerCase() === path.resolve(p).toLowerCase();

/** Relative input resolves against base; forward slashes are normalized. */
export const resolveAgainst = (base, input) => path.resolve(base, input.replace(/\//g, path.sep));

/** "D:\a\b" -> [{label:"D:", path:"D:\"}, {label:"a", path:"D:\a"}, ...] for breadcrumbs and the tree. */
export function pathSegments(p) {
  const full = path.resolve(p), root = path.parse(full).root;
  const out = [{ label: root.replace(/[\\/]+$/, '') || root, path: root }];
  let cur = root;
  for (const part of full.slice(root.length).split(path.sep).filter(Boolean)) {
    cur = path.join(cur, part);
    out.push({ label: part, path: cur });
  }
  return out;
}
