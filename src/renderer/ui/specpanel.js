// specpanel.js - "Spec checklist & log" slide-over (a grading aid, gated by SHOW_SPEC_PANEL).
import { $, esc, icon } from './dom.js';

const COV = [
  ['create', 'Create a file', 'Press N. It never overwrites.'],
  ['read', 'Read a file', 'Press Enter to open the viewer.'],
  ['append', 'Append to a file', 'Press A. The file must already exist.'],
  ['rename', 'Rename a file', 'Press F2. Name conflicts show as you type.'],
  ['delete', 'Delete with confirmation', 'Press Delete. Cancel is the default.'],
  ['info', 'Show file information', 'Select any file or folder.'],
  ['noover', 'Overwrite blocked', 'Type an existing name in New or Rename.'],
  ['invalid', 'Bad name rejected', 'Try a?b.txt or CON.'],
  ['missing', 'Missing-file check', 'Delete a file in File Explorer, then open it here.'],
  ['menu', 'Menu navigation', 'Open the File menu with Alt+F or F10.'],
];

let devOpen = false;
export const devIsOpen = () => devOpen;

export function initDev(enabled) {
  $('#devbtn').hidden = !enabled;
  $('#dev').hidden = !enabled;
  $('#devx').innerHTML = icon('x', 16);
}

export function toggleDev(open) {
  devOpen = open === undefined ? !devOpen : open;
  $('#dev').classList.toggle('open', devOpen);
  $('#devbtn').setAttribute('aria-expanded', devOpen);
}

/** cov: Set of ticked keys; logs: [{t, ok}] newest first. */
export function renderDev(cov, logs) {
  $('#cov').innerHTML = COV.map((c) => '<li class="' + (cov.has(c[0]) ? 'done' : '') + '"><span class="tick">' + icon('check', 11) + '</span><span>' + c[1] + '<small>' + c[2] + '</small></span></li>').join('');
  $('#devcnt').textContent = cov.size + '/' + COV.length;
  $('#meterfill').style.width = (cov.size / COV.length * 100) + '%';
  $('#log').innerHTML = logs.length ? logs.slice(0, 40).map((l) => '<li class="' + (l.ok ? '' : 'err') + '">' + esc(l.t) + '</li>').join('')
    : '<li class="none">Nothing yet. Press N to create a file.</li>';
}
