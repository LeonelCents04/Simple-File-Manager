// format.js - display formatting shared by the main process and the renderer.
// Pure functions: no Node, no DOM.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');

export function formatSize(n) {
  const units = ['KB', 'MB', 'GB', 'TB'];
  if (n < 1024) return n + ' B';
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
  return n.toFixed(1) + ' ' + units[i];
}

/** "Oct 17, 2026, 3:42 PM" */
export function formatModified(t) {
  const d = new Date(t);
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ', ' + h + ':' + p2(d.getMinutes()) + ' ' + ap;
}

/** Bytes the text takes on disk; crlf = files are written with Windows line endings. */
export function byteLength(text, crlf) {
  return new TextEncoder().encode(crlf ? text.replace(/\r?\n/g, '\r\n') : text).length;
}

export const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
