import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatError, successText } from '../src/shared/messages.js';
import { formatSize, formatModified, byteLength } from '../src/shared/format.js';

const R = (code, extra = {}) => ({ code, sysErrno: null, ...extra });

test('section 10: exact strings', () => {
  assert.equal(formatError('create', 'x', R('FM_ERR_EXISTS')), 'Cannot create "x": it already exists. Nothing was changed.');
  assert.equal(formatError('create', 'x', R('FM_ERR_NOT_FOUND')), 'Cannot create "x": that folder does not exist.');
  assert.equal(formatError('read', 'x', R('FM_ERR_NOT_FOUND')), 'Cannot open "x": it no longer exists. The list has been refreshed.');
  assert.equal(formatError('append', 'x', R('FM_ERR_NOT_FOUND')), 'Cannot append to "x": it no longer exists. The list has been refreshed.');
  assert.equal(formatError('rename', 'x', R('FM_ERR_NOT_FOUND')), 'Cannot rename "x": it no longer exists. The list has been refreshed.');
  assert.equal(formatError('delete', 'x', R('FM_ERR_NOT_FOUND')), 'Cannot delete "x": it no longer exists. The list has been refreshed.');
  assert.equal(formatError('append', 'x', R('FM_ERR_PERMISSION')), 'Cannot append to "x": it is read-only.');
  assert.equal(formatError('delete', 'x', R('FM_ERR_PERMISSION')), 'Cannot delete "x": it is read-only.');
  assert.equal(formatError('append', 'x', R('FM_ERR_IS_DIR')), 'Cannot append to "x": it is a folder.');
  assert.equal(formatError('delete', 'x', R('FM_ERR_IS_DIR')), 'Cannot delete "x": it is a folder.');
  assert.equal(formatError('rename', 'x', R('FM_ERR_IS_DIR')), 'Cannot rename "x": it is a folder.');
  assert.equal(formatError('read', 'x', R('FM_ERR_BINARY')), '"x" is a binary file, so it cannot be shown as text.');
  assert.equal(formatError('rename', 'y', R('FM_ERR_EXISTS')), 'Cannot rename: "y" already exists.');
  assert.equal(formatError('rename', 'y', R('FM_ERR_CROSS_DEVICE')), 'Cannot rename across drives.');
  assert.equal(formatError('create', 'x', R('FM_ERR_PATH_TOO_LONG')), 'Cannot create "x": the path is 260 characters or longer.');
  assert.equal(formatError('create', 'a?b', R('FM_ERR_INVALID_NAME', { detail: 'The character "?" is not allowed in file names.' })),
    'Cannot create "a?b": The character "?" is not allowed in file names.');
  assert.equal(formatError('append', 'x', R('FM_ERR_NO_SPACE', { sysErrno: 'ENOSPC' })), 'Something went wrong while trying to append to "x". (disk full)');
  assert.equal(formatError('delete', 'x', R('FM_ERR_IO', { sysErrno: 'EWHATEVER' })), 'Something went wrong while trying to delete "x".');

  assert.equal(successText('create', 'x', 322), 'Created "x" (322 bytes).');
  assert.equal(successText('append', 'x', 41), 'Appended 41 bytes to "x".');
  assert.equal(successText('rename', 'a', 'b'), 'Renamed "a" to "b".');
  assert.equal(successText('delete', 'x'), 'Deleted "x".');
  assert.equal(successText('refresh'), 'Refreshed.');
});

test('formatting', () => {
  assert.equal(formatSize(322), '322 B');
  assert.equal(formatSize(1536), '1.5 KB');
  assert.equal(formatSize(1048576), '1.0 MB');
  assert.equal(formatSize(31.5 * 2 ** 30), '31.5 GB');
  assert.equal(formatSize(2 * 2 ** 40), '2.0 TB');
  assert.equal(formatSize(5000 * 2 ** 40), '5000.0 TB');
  assert.equal(formatModified(new Date(2026, 9, 17, 15, 42).getTime()), 'Oct 17, 2026, 3:42 PM');
  assert.equal(formatModified(new Date(2026, 0, 2, 0, 5).getTime()), 'Jan 2, 2026, 12:05 AM');
  assert.equal(byteLength('a\nb\n', true), 6);
  assert.equal(byteLength('a\nb\n', false), 4);
  assert.equal(byteLength('é', false), 2);
});
