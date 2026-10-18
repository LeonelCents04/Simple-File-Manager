// sidebar.js - folder tree: every available drive, with the current drive opened down to
// the current folder and that folder's subfolders. Deep paths are shortened like the breadcrumbs.
import { $, esc, icon } from './dom.js';
import { visibleSegments } from './breadcrumbs.js';
import { formatSize } from '../../shared/format.js';
import { INFO } from '../../shared/messages.js';

/** segments: [{label, path}] of the current folder; children: its subfolder names;
 *  drives: [{path, label, total, free}]; join: (dir, name) => path */
export function renderTree(segments, children, join, drives) {
  if (!segments.length) return;
  const cur = segments[segments.length - 1];
  const node = (path, label, depth, ic, isCur, title) =>
    '<button class="node' + (isCur ? ' cur' : '') + '" data-depth="' + depth + '" data-go="' + esc(path) + '"' +
    (isCur ? ' aria-current="page"' : '') + ' title="' + esc(title || path) + '">' + icon(ic, 16) + '<span>' + esc(label) + '</span></button>';
  const space = (d) => d.label + ' — ' + INFO.driveSpace(formatSize(d.free), formatSize(d.total));

  // The open drive: its own row (with its size), then the shortened path and the subfolders.
  const vis = visibleSegments(segments, 2);
  const openDrive = (d) =>
    node(vis[0].path, vis[0].label, 0, 'drive', vis.length === 1, d ? space(d) : vis[0].path) +
    vis.slice(1).map((s, i) => node(s.path, s.label, i + 1, 'folder', i + 2 === vis.length)).join('') +
    children.map((c) => node(join(cur.path, c), c, vis.length, 'folder', false)).join('');

  const isOpen = (d) => d.path.toLowerCase() === segments[0].path.toLowerCase();
  let h = drives.map((d) => (isOpen(d) ? openDrive(d) : node(d.path, d.label, 0, 'drive', false, space(d)))).join('');
  if (!drives.some(isOpen)) h = openDrive(null) + h;   // e.g. a network path (\\server\share)

  const el = $('#tree');
  el.innerHTML = h;
  // CSP allows CSSOM but not style attributes, so the indent is set here.
  el.querySelectorAll('.node').forEach((b) => b.style.setProperty('--d', b.dataset.depth));
}
