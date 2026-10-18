// toasts.js - toasts and the status bar.
import { $, esc, icon } from './dom.js';
import { plural } from '../../shared/format.js';
import { INFO } from '../../shared/messages.js';

export function toast(kind, text) {
  const host = $('#toasts'), el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.innerHTML = icon(kind === 'ok' ? 'checkc' : kind === 'err' ? 'alert' : 'info', 18) + '<span>' + esc(text) + '</span>' +
    '<button class="tx-x" aria-label="Dismiss">' + icon('x', 14) + '</button>';
  const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  el.querySelector('.tx-x').addEventListener('click', dismiss);
  host.appendChild(el);
  while (host.children.length > 3) host.firstChild.remove();
  setTimeout(dismiss, kind === 'err' ? 6500 : 3400);
}

export function renderBar(count, hasSelection) {
  $('#bar').innerHTML = '<span>' + plural(count, 'item') + (hasSelection ? ', 1 selected' : '') + '</span><span class="safe">' + icon('shield', 15) + INFO.safe + '</span>';
}
