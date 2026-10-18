// contextmenu.js - right-click menu on a file row.
import { icon } from './dom.js';

let ctxEl = null;

export const ctxOpen = () => ctxEl !== null;

export function closeCtx() {
  if (ctxEl) { ctxEl.remove(); ctxEl = null; }
}

export function openCtx(x, y) {
  closeCtx();
  const m = document.createElement('div');
  m.className = 'ctx';
  m.setAttribute('role', 'menu');
  const it = (act, ic, label, key, cls) => '<button class="ci' + (cls ? ' ' + cls : '') + '" role="menuitem" data-cx="' + act + '">' + icon(ic, 16) + '<span>' + label + '</span><kbd>' + key + '</kbd></button>';
  m.innerHTML = it('open', 'eye', 'Open', 'Enter') + it('append', 'append', 'Append', 'A') + it('rename', 'rename', 'Rename', 'F2') + '<hr>' + it('delete', 'trash', 'Delete', 'Del', 'danger');
  document.body.appendChild(m);
  m.style.left = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - m.offsetHeight - 8)) + 'px';
  ctxEl = m;
  m.firstChild.focus();
}

export function ctxKeys(e) {
  const items = [...ctxEl.querySelectorAll('.ci')], i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i + items.length - 1) % items.length].focus(); }
  else if (e.key === 'Tab') closeCtx();
}
