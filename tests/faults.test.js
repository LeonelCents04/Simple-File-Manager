// Failures that cannot be produced on demand (disk full, failed close, short writes)
// are injected by replacing one fs function for the duration of a test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fm_create, fm_append } from '../src/main/file_ops.js';
import { formatError } from '../src/shared/messages.js';
import { tempDir, text } from './helpers.js';

const errno = (code) => Object.assign(new Error(code), { code });

test('disk full while creating: reported, partial file removed', (t) => {
  const p = tempDir(t);
  t.mock.method(fs, 'writeSync', () => { throw errno('ENOSPC'); });
  const r = fm_create(p('big.txt'), 'hello\n');
  t.mock.restoreAll();
  assert.equal(r.code, 'FM_ERR_NO_SPACE');
  assert.equal(r.sysErrno, 'ENOSPC');
  assert.equal(fs.existsSync(p('big.txt')), false);
  assert.equal(formatError('create', 'big.txt', r), 'Something went wrong while trying to create "big.txt". (disk full)');
});

test('disk full while appending: reported, file restored to its old content', (t) => {
  const p = tempDir(t);
  fm_create(p('a.txt'), 'one\n');
  let calls = 0;
  const real = fs.writeSync;
  // First write lands half the data, then the disk is full.
  t.mock.method(fs, 'writeSync', (fd, buf, off, len) => {
    if (calls++ === 0) return real(fd, buf, off, Math.ceil(len / 2));
    throw errno('ENOSPC');
  });
  const r = fm_append(p('a.txt'), 'two two two\n');
  t.mock.restoreAll();
  assert.equal(r.code, 'FM_ERR_NO_SPACE');
  assert.equal(text(p('a.txt')), 'one\n');
});

test('short writes are completed by the write loop', (t) => {
  const p = tempDir(t);
  const real = fs.writeSync;
  t.mock.method(fs, 'writeSync', (fd, buf, off, len) => real(fd, buf, off, Math.min(len, 3)));
  const r = fm_create(p('s.txt'), 'abcdefghij');
  fm_append(p('s.txt'), 'klmnop');
  t.mock.restoreAll();
  assert.equal(r.code, 'FM_OK');
  assert.equal(text(p('s.txt')), 'abcdefghij\nklmnop');
});

test('a failed close after writing is reported as an I/O error', (t) => {
  const p = tempDir(t);
  const real = fs.closeSync;
  t.mock.method(fs, 'closeSync', (fd) => { real(fd); throw errno('EIO'); });
  const r = fm_create(p('c.txt'), 'x');
  t.mock.restoreAll();
  assert.equal(r.code, 'FM_ERR_IO');
  assert.equal(r.sysErrno, 'EIO');
  assert.equal(fs.existsSync(p('c.txt')), false);   // data may be lost, so the file is not kept
});

test('a failed fsync is reported and nothing is left behind', (t) => {
  const p = tempDir(t);
  t.mock.method(fs, 'fsyncSync', () => { throw errno('EIO'); });
  const r = fm_create(p('f.txt'), 'x');
  t.mock.restoreAll();
  assert.equal(r.code, 'FM_ERR_IO');
  assert.equal(fs.existsSync(p('f.txt')), false);
});
