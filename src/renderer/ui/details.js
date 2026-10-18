// details.js - details panel and preview for the selected entry.
import { $, esc, icon } from './dom.js';
import { formatSize, formatModified, plural } from '../../shared/format.js';
import { INFO } from '../../shared/messages.js';

/** Rows shared by the panel and the File information sheet. */
export function factsHtml(e, extra, location) {
  const size = e.isDir ? (extra.count === undefined ? '…' : plural(extra.count, 'item')) : formatSize(e.size) + ' (' + e.size + ' bytes)';
  return '<dl><dt>Size</dt><dd>' + size + '</dd>' +
    '<dt>Modified</dt><dd>' + (e.mtimeMs ? formatModified(e.mtimeMs) : '') + '</dd>' +
    '<dt>Location</dt><dd>' + esc(location) + '</dd>' +
    '<dt>Read-only</dt><dd>' + (e.isReadOnly ? 'Yes' : 'No') + '</dd></dl>';
}

export const kindOf = (e, extra) => (e.isDir ? 'Folder' : extra.binary ? 'Binary file' : 'Text file');

/** e: list entry or null; extra: {preview, binary, count} loaded asynchronously. */
export function renderDetails(e, extra, location) {
  const el = $('#details');
  if (!e) {
    el.innerHTML = '<div class="d-empty">' + icon('file', 30) + '<span>' + INFO.noSelection + '</span></div>';
    return;
  }
  let pv;
  if (e.isDir) pv = '<div class="pv note">' + (extra.count === undefined ? '' : plural(extra.count, 'item') + ' inside.') + '</div>';
  else if (extra.binary) pv = '<div class="pv note">' + INFO.binaryPreview + '</div>';
  else pv = '<div class="pv"><code>' + esc((extra.preview || '').split('\n').slice(0, 10).join('\n')) + '</code></div>';
  el.innerHTML =
    '<div class="d-tile' + (e.isDir ? ' dir' : '') + '">' + icon(e.isDir ? 'folder' : 'file', 26) + '</div>' +
    '<h2>' + esc(e.name) + '</h2>' +
    '<div class="chips"><span class="chip">' + kindOf(e, extra) + '</span>' + (e.isReadOnly ? '<span class="chip warn">Read-only</span>' : '') + '</div>' +
    factsHtml(e, extra, location) + pv;
}
