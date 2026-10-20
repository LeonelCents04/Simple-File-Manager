// menubar.js - File / Go / Help menus and their keyboard handling.
import { $, esc, icon } from './dom.js';
import { formatSize } from '../../shared/format.js';
import { INFO } from '../../shared/messages.js';

export const NEEDS_FILE = ['open', 'append', 'rename', 'delete', 'props'];

/** recents: recent folder paths; drives: [{path, label, free, total}] for the Go menu. */
function menus(recents, drives) {
  return [
    { label: 'File', key: 'f', items: [
      ['new', 'plus', 'New file', 'N'], ['open', 'eye', 'Open', 'Enter'], ['append', 'append', 'Append', 'A'],
      ['rename', 'rename', 'Rename', 'F2'], ['delete', 'trash', 'Delete', 'Del', 1], '-',
      ['props', 'info', 'File information', 'I'], ['refresh', 'refresh', 'Refresh', 'F5'], '-',
      ['exit', 'x', 'Exit', '']] },
    { label: 'Go', key: 'g', items: [
      ['up', 'up', 'Up one folder', 'Backspace'], '-',
      ['pick', 'open', 'Open folder…', ''],
      ...(drives.length ? ['-', { label: 'Drives' }] : []),
      ...drives.map((d, i) => ['drive:' + i, 'drive', d.label, INFO.driveFree(formatSize(d.free)), 0, d.path]),
      ...(recents.length ? ['-', { label: 'Recent folders' }] : []),
      ...recents.map((p, i) => ['recent:' + i, 'clock', p, ''])] },
    { label: 'Help', key: 'h', items: [
      ['keys', 'info', 'Keyboard shortcuts', ''], ['spec', 'checkc', 'Spec checklist', '']] },
  ];
}

export const MENU_KEYS = ['f', 'g', 'h'];
let menuEl = null, menuIdx = -1;

export const menuOpenIndex = () => menuIdx;

export function buildMenubar() {
  $('#menubar').innerHTML = menus([], []).map((m, i) =>
    '<button class="mbtn" data-m="' + i + '" role="menuitem" aria-haspopup="true" aria-expanded="false" title="' + m.label + ' menu (Alt+' + m.key.toUpperCase() + ')">' + m.label + '</button>').join('');
}

export function closeMenu(refocus) {
  if (menuEl) { menuEl.remove(); menuEl = null; }
  const b = document.querySelector('.mbtn[aria-expanded="true"]');
  if (b) {
    b.setAttribute('aria-expanded', 'false');
    if (refocus) b.focus();
  }
  menuIdx = -1;
}

/** Opens menu i (or closes it if already open). */
export function toggleMenu(i, focusFirst, hasSelection, recents, drives) {
  if (menuIdx === i) { closeMenu(); return; }
  closeMenu();
  menuIdx = i;
  const btn = document.querySelector('.mbtn[data-m="' + i + '"]');
  btn.setAttribute('aria-expanded', 'true');
  const m = document.createElement('div');
  m.className = 'ctx';
  m.setAttribute('role', 'menu');
  // Item: [id, icon, label, key hint or (for drives) free space, danger, tooltip]
  m.innerHTML = menus(recents, drives)[i].items.map((it) => {
    if (it === '-') return '<hr>';
    if (it.label) return '<div class="lbl">' + it.label + '</div>';
    const isDrive = it[0].startsWith('drive:');
    return '<button class="ci' + (it[4] ? ' danger' : '') + '" role="menuitem" data-mi="' + esc(it[0]) + '" title="' + esc(it[5] || it[2]) + '"' +
      (NEEDS_FILE.includes(it[0]) && !hasSelection ? ' disabled' : '') + '>' +
      icon(it[1], 16) + '<span>' + esc(it[2]) + '</span>' +
      (it[3] ? (isDrive ? '<small class="aside">' + esc(it[3]) + '</small>' : '<kbd>' + it[3] + '</kbd>') : '') + '</button>';
  }).join('');
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = (r.bottom + 6) + 'px';
  m.style.maxHeight = (innerHeight - r.bottom - 14) + 'px';   // scrolls instead of running off a short window
  menuEl = m;
  if (focusFirst) {
    const f = m.querySelector('.ci:not(:disabled)');
    if (f) f.focus();
  }
}

/** Arrow keys inside an open menu; returns the menu index to switch to, or -1. */
export function menuKeys(e) {
  const items = [...menuEl.querySelectorAll('.ci:not(:disabled)')], i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i < 0 ? 0 : i + items.length - 1) % items.length].focus(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); return (menuIdx + 1) % MENU_KEYS.length; }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); return (menuIdx + MENU_KEYS.length - 1) % MENU_KEYS.length; }
  else if (e.key === 'Tab') closeMenu();
  return -1;
}
