// breadcrumbs.js - location, Up, Refresh and theme buttons.
import { $, esc, icon } from './dom.js';

/** Long paths keep the drive and the last three folders; the middle becomes "…". */
export function visibleSegments(segments, keep = 3) {
  if (segments.length <= keep + 2) return segments;
  return [segments[0], { label: '…', path: segments[segments.length - keep - 1].path, gap: true }, ...segments.slice(-keep)];
}

export function renderTop(segments, canGoUp, dark) {
  const vis = visibleSegments(segments);
  $('#crumbs').innerHTML = vis.map((s, i) => {
    const last = i === vis.length - 1;
    return (i ? '<span class="sep" aria-hidden="true">' + icon('chev', 14) + '</span>' : '') +
      '<button class="crumb' + (last ? ' last' : '') + '"' + (last ? ' aria-current="page"' : ' data-go="' + esc(s.path) + '"') +
      (s.gap ? ' title="' + esc(s.path) + '" aria-label="Go to ' + esc(s.path) + '"' : '') + '>' + esc(s.label) + '</button>';
  }).join('');
  $('#crumbs').title = segments.length ? segments[segments.length - 1].path : '';
  $('#upbtn').innerHTML = icon('up', 18);
  $('#upbtn').disabled = !canGoUp;
  $('#refreshbtn').innerHTML = icon('refresh', 18);
  $('#themebtn').innerHTML = icon(dark ? 'sun' : 'moon', 18);
}
