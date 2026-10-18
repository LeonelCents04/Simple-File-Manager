// toolbar.js - New / Open / Append / Rename / Delete. All but New need a selection.
import { $, icon } from './dom.js';

export function renderTools(hasSelection) {
  const b = (act, ic, label, key, cls) =>
    '<button class="tb' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (act !== 'new' && !hasSelection ? ' disabled' : '') +
    ' title="' + label + (key ? ' (' + key + ')' : '') + '">' + icon(ic, 17) + '<span class="lbl">' + label + '</span>' + (key ? '<kbd>' + key + '</kbd>' : '') + '</button>';
  $('#tools').innerHTML = b('new', 'plus', 'New file', 'N', 'primary') + b('open', 'eye', 'Open', 'Enter') +
    b('append', 'append', 'Append', 'A') + b('rename', 'rename', 'Rename', 'F2') + b('delete', 'trash', 'Delete', 'Del', 'del');
}
