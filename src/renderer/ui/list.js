// list.js - file list rows.
import { $, esc, icon } from './dom.js';
import { formatSize, formatModified } from '../../shared/format.js';
import { INFO } from '../../shared/messages.js';

export function renderRows(entries, selName) {
  const el = $('#rows'), st = el.scrollTop;
  if (!entries.length) {
    el.innerHTML = '<div class="empty">' + icon('folder', 30) + '<b>' + INFO.empty + '</b><span>' + INFO.emptyHint + '</span></div>';
    return;
  }
  el.innerHTML = entries.map((e) => {
    const sel = e.name === selName;
    return '<div class="row' + (sel ? ' sel' : '') + '" role="option" aria-selected="' + sel + '" data-name="' + esc(e.name) + '">' +
      '<div class="nm"><span class="ico' + (e.isDir ? ' dir' : '') + '">' + icon(e.isDir ? 'folder' : 'file', 16) + '</span><span class="t">' + esc(e.name) + '</span></div>' +
      '<span class="sz">' + (e.isDir ? '' : formatSize(e.size)) + '</span><span class="md">' + (e.mtimeMs ? formatModified(e.mtimeMs) : '') + '</span></div>';
  }).join('');
  el.scrollTop = st;
}

export function scrollSelectedIntoView() {
  const r = $('.row.sel');
  if (r) r.scrollIntoView({ block: 'nearest' });
}
