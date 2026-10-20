// breadcrumbs.js - location, Up, Refresh and theme buttons.
import { $, esc, icon } from './dom.js';

/** Long paths keep the drive and the last three folders; the middle becomes "…". */
export function visibleSegments(segments, keep = 3) {
  if (segments.length <= keep + 2) return segments;
  return [segments[0], { label: '…', path: segments[segments.length - keep - 1].path, gap: true }, ...segments.slice(-keep)];
}

/** Hides the oldest folders behind "…" until the trail fits on one line; the drive and current folder stay. */
function fitCrumbs() {
  const box = $('#crumbs'), gap = box.querySelector('.gap'), mids = [...box.querySelectorAll('.seg.mid')];
  if (!gap) return;
  box.classList.add('fit');                    // measure at natural widths, before the current folder shrinks
  gap.hidden = true;
  for (const m of mids) m.hidden = false;
  for (const m of mids) {
    if (box.scrollWidth <= box.clientWidth) break;
    m.hidden = true;
    gap.hidden = false;
    const b = gap.lastElementChild, p = m.lastElementChild.dataset.go;
    b.dataset.go = p; b.title = p; b.setAttribute('aria-label', 'Go to ' + p);
  }
  box.classList.remove('fit');
}

export function renderTop(segments, canGoUp, dark) {
  const sep = '<span class="sep" aria-hidden="true">' + icon('chev', 14) + '</span>', n = segments.length;
  $('#crumbs').innerHTML = segments.map((s, i) => {
    const last = i === n - 1;
    const btn = '<button class="crumb' + (last ? ' last' : '') + '"' + (last ? ' aria-current="page"' : ' data-go="' + esc(s.path) + '"') + '>' + esc(s.label) + '</button>';
    if (i === 0) return btn + (n > 2 ? '<span class="seg gap" hidden>' + sep + '<button class="crumb">…</button></span>' : '');
    return '<span class="seg' + (last ? ' cur' : ' mid') + '">' + sep + btn + '</span>';
  }).join('');
  $('#crumbs').title = n ? segments[n - 1].path : '';
  fitCrumbs();
  $('#upbtn').innerHTML = icon('up', 18);
  $('#upbtn').disabled = !canGoUp;
  $('#refreshbtn').innerHTML = icon('refresh', 18);
  $('#themebtn').innerHTML = icon(dark ? 'sun' : 'moon', 18);
}

// The row's width follows the window (snapping, resizing), so refit whenever it changes.
new ResizeObserver(fitCrumbs).observe($('#crumbs').parentElement);
