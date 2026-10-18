// sheets.js - dialog shell (scrim, focus trap, Esc) and the markup of each sheet.
// The flows that fill them live in app.js.
import { $, esc, icon } from './dom.js';
import { formatSize, formatModified, plural } from '../../shared/format.js';
import { INFO } from '../../shared/messages.js';

let sheetEl = null, lastFocus = null;

export const sheetOpen = () => sheetEl !== null;

/** Opens a sheet and returns its card element. */
export function openSheet(inner, wide) {
  if (sheetEl) closeSheet(true);
  lastFocus = document.activeElement;
  const sc = document.createElement('div');
  sc.className = 'scrim';
  sc.innerHTML = '<div class="sheet' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="sh-t">' + inner + '</div>';
  $('#layer').appendChild(sc);
  sheetEl = sc;
  sc.addEventListener('mousedown', (e) => { if (e.target === sc) closeSheet(); });
  return sc.firstChild;
}

/** keepFocus: another sheet is about to open, so don't send focus back yet. */
export function closeSheet(keepFocus) {
  if (!sheetEl) return;
  sheetEl.remove();
  sheetEl = null;
  if (!keepFocus && lastFocus && lastFocus.isConnected) lastFocus.focus();
  else if (!keepFocus) $('#rows').focus();
}

export function trapTab(e) {
  const f = [...sheetEl.querySelectorAll('button:not(:disabled),input,textarea,[tabindex="0"]')].filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function setHint(el, state, msg) {
  el.className = 'hint' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : '');
  el.innerHTML = icon(state === 'ok' ? 'check' : state === 'err' ? 'alert' : 'info', 15) + '<span>' + esc(msg) + '</span>';
}

const actions = (cancel, goId, goLabel, cls) =>
  '<div class="actions"><button class="btn" data-x="cancel">' + cancel + '</button><button class="btn ' + cls + '" id="' + goId + '" disabled>' + goLabel + '</button></div>';

export const sheetNew = () => openSheet(
  '<h3 id="sh-t">New file</h3><p class="sub">Give it a name or a path. An existing file is never replaced.</p>' +
  '<label for="f-name">Name or path</label><input id="f-name" type="text" autocomplete="off" spellcheck="false" placeholder="notes.txt or docs\\ideas.txt">' +
  '<div class="hint" id="f-hint"></div>' +
  '<label for="f-content">Content <span class="count" id="f-count">0 bytes</span></label>' +
  '<textarea id="f-content" spellcheck="false" placeholder="Optional. Type or paste text."></textarea>' +
  actions('Cancel', 'f-go', 'Create file', 'primary'));

/** content: {text, size, truncated, isReadOnly} */
export function sheetViewer(name, c) {
  const lines = c.text.replace(/\t/g, '    ').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const sh = openSheet(
    '<h3 id="sh-t">' + esc(name) + '</h3><div class="meta"><span class="chip">' + formatSize(c.size) + '</span><span class="chip">' + plural(lines.length, 'line') + (c.truncated ? ' shown' : '') + '</span>' +
    (c.isReadOnly ? '<span class="chip warn">Read-only</span>' : '') + '</div>' +
    (c.truncated ? '<p class="banner" role="note">' + INFO.truncated(c.size) + '</p>' : '') +
    '<div class="code" tabindex="0" aria-label="File contents">' + chunks(lines) + '</div>' +
    '<div class="actions"><button class="btn primary" data-x="cancel" id="v-close">Close</button></div>', true);
  // Same width for every chunk's number column (CSP: set through CSSOM, not a style attribute).
  $('.code', sh).style.setProperty('--lnw', String(lines.length).length + 'ch');
  $('#v-close', sh).focus();
  return sh;
}

/** Blocks of 400 lines; off-screen blocks are skipped by the browser (content-visibility),
 *  so a 1 MiB file opens in well under a second instead of several seconds. */
function chunks(lines, size = 400) {
  let h = '';
  for (let i = 0; i < lines.length; i += size) {
    const part = lines.slice(i, i + size);
    h += '<div class="chunk"><div class="ln">' + part.map((_, k) => i + k + 1).join('\n') + '</div><div class="tx">' + esc(part.join('\n')) + '</div></div>';
  }
  return h;
}

export const sheetAppend = (name) => openSheet(
  '<h3 id="sh-t">Append to ' + esc(name) + '</h3><p class="sub">Your text is added to the end. Nothing already in the file changes.</p>' +
  '<label for="a-text">Text to add <span class="count" id="a-count">0 bytes</span></label>' +
  '<textarea id="a-text" spellcheck="false" placeholder="Type or paste text."></textarea>' +
  '<div class="hint" id="a-hint"></div>' +
  actions('Cancel', 'a-go', 'Append', 'primary'));

export const sheetRename = (name) => openSheet(
  '<h3 id="sh-t">Rename</h3><p class="sub">Choose a new name for &ldquo;' + esc(name) + '&rdquo;.</p>' +
  '<label for="r-name">New name</label><input id="r-name" type="text" autocomplete="off" spellcheck="false">' +
  '<div class="hint" id="r-hint"></div>' +
  actions('Cancel', 'r-go', 'Rename', 'primary'));

export function sheetDelete(name, size, mtimeMs) {
  const sh = openSheet(
    '<div class="warn-ico">' + icon('trash', 22) + '</div><h3 id="sh-t">Delete &ldquo;' + esc(name) + '&rdquo;?</h3>' +
    '<p class="sub">' + formatSize(size) + ', last changed ' + formatModified(mtimeMs) + '. This cannot be undone.</p>' +
    '<div class="actions"><button class="btn" id="d-no" data-x="cancel">Cancel</button><button class="btn danger" id="d-yes">Delete file</button></div>');
  $('#d-no', sh).focus();   // Cancel is the default
  return sh;
}

export function sheetInfo(name, kind, facts) {
  const sh = openSheet(
    '<h3 id="sh-t">File information</h3><p class="sub">' + esc(name) + '</p>' +
    facts.replace('<dl>', '<dl><dt>Type</dt><dd>' + kind + '</dd>') +
    '<div class="actions"><button class="btn primary" data-x="cancel" id="p-ok">Close</button></div>');
  $('#p-ok', sh).focus();
  return sh;
}

export function sheetKeys() {
  const rows = [['N', 'New file'], ['Enter', 'Open a file or folder'], ['A', 'Append to the selected file'], ['F2', 'Rename'], ['Delete', 'Delete, after asking'],
    ['Backspace', 'Up one folder'], ['I', 'File information'], ['F5', 'Refresh'], ['Alt+F or F10', 'Open the File menu'], ['Ctrl+Enter', 'Save in a text box'], ['Esc', 'Close a dialog or menu']];
  const sh = openSheet('<h3 id="sh-t">Keyboard shortcuts</h3><p class="sub">Everything in the menus also has a key.</p>' +
    '<dl class="keys">' + rows.map((r) => '<dt><kbd>' + r[0] + '</kbd></dt><dd>' + r[1] + '</dd>').join('') + '</dl>' +
    '<div class="actions"><button class="btn primary" data-x="cancel" id="k-ok">Close</button></div>');
  $('#k-ok', sh).focus();
  return sh;
}

export function sheetExit() {
  const sh = openSheet(
    '<div class="warn-ico accent">' + icon('x', 22) + '</div><h3 id="sh-t">Close Files?</h3>' +
    '<p class="sub">Every change is already saved. Nothing is waiting to be written.</p>' +
    '<div class="actions"><button class="btn" id="x-no" data-x="cancel">Stay</button><button class="btn primary" id="x-yes">Close app</button></div>');
  $('#x-no', sh).focus();
  return sh;
}
