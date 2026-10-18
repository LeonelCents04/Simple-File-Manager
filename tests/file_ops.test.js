import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Worker } from 'node:worker_threads';
import { fm_create, fm_read, fm_append, fm_rename, fm_delete, fm_get_info, fm_exists } from '../src/main/file_ops.js';
import { tempDir, IS_WIN, text } from './helpers.js';

test('create', (t) => {
  const p = tempDir(t);
  assert.equal(fm_create(p('a.txt'), 'hello').code, 'FM_OK');
  assert.equal(fm_get_info(p('a.txt')).data.size, 5);

  // Existing file: refused and unchanged.
  assert.equal(fm_create(p('a.txt'), 'OVERWRITE').code, 'FM_ERR_EXISTS');
  assert.equal(text(p('a.txt')), 'hello');

  assert.equal(fm_create(p('missing', 'x.txt'), 'x').code, 'FM_ERR_NOT_FOUND');
  assert.equal(fm_create(p('empty.txt'), '').code, 'FM_OK');
  assert.equal(fs.statSync(p('empty.txt')).size, 0);
  assert.equal(fm_create(p('a?b.txt'), 'x').code, 'FM_ERR_INVALID_NAME');
  assert.equal(fm_exists(p('a?b.txt')), false);
  assert.equal(fm_create(p('CON'), 'x').code, 'FM_ERR_INVALID_NAME');
  assert.equal(fm_create(p('b'.repeat(300)), 'x').code, 'FM_ERR_PATH_TOO_LONG');
  assert.equal(fm_create(p('a.txt'), 42).code, 'FM_ERR_INVALID_ARG');

  // CRLF check: 3 lines are 9 bytes on Windows, 6 elsewhere.
  const r = fm_create(p('three.txt'), 'a\nb\nc\n');
  assert.equal(r.code, 'FM_OK');
  assert.equal(fs.statSync(p('three.txt')).size, IS_WIN ? 9 : 6);
  assert.equal(r.data.bytes, IS_WIN ? 9 : 6);

  // A folder with the same name blocks creation.
  fs.mkdirSync(p('dir'));
  assert.equal(fm_create(p('dir'), 'x').code, 'FM_ERR_EXISTS');
});

test('create: two racing creates on the same name, exactly one wins', async (t) => {
  const p = tempDir(t);
  const target = p('race.txt');
  const src = `
    import { workerData, parentPort } from 'node:worker_threads';
    import { fm_create } from ${JSON.stringify(new URL('../src/main/file_ops.js', import.meta.url).href)};
    Atomics.wait(new Int32Array(workerData.flag), 0, 0);   // start together
    parentPort.postMessage(fm_create(workerData.target, workerData.text).code);`;
  const flag = new SharedArrayBuffer(4);
  const run = (txt) => new Promise((res, rej) => {
    const w = new Worker(new URL('data:text/javascript,' + encodeURIComponent(src)), { workerData: { target, text: txt, flag } });
    w.once('message', res);
    w.once('error', rej);
  });
  const both = Promise.all([run('one'), run('two')]);
  setTimeout(() => { Atomics.store(new Int32Array(flag), 0, 1); Atomics.notify(new Int32Array(flag), 0); }, 200);
  const codes = (await both).sort();
  assert.deepEqual(codes, ['FM_ERR_EXISTS', 'FM_OK']);
  assert.ok(['one', 'two'].includes(text(target)));
});

test('read', (t) => {
  const p = tempDir(t);
  fm_create(p('r.txt'), 'line1\nline2\n');
  const r = fm_read(p('r.txt'));
  assert.equal(r.code, 'FM_OK');
  assert.equal(r.data.text, 'line1\nline2\n');   // \r stripped
  assert.equal(r.data.truncated, false);

  assert.equal(fm_read(p('nope.txt')).code, 'FM_ERR_NOT_FOUND');
  fs.mkdirSync(p('d'));
  assert.equal(fm_read(p('d')).code, 'FM_ERR_IS_DIR');

  fs.writeFileSync(p('bin.dat'), Buffer.from([0x61, 0, 0x62]));
  const b = fm_read(p('bin.dat'));
  assert.equal(b.code, 'FM_ERR_BINARY');
  assert.equal(b.data.looksBinary, true);

  fs.writeFileSync(p('big.txt'), 'x'.repeat(100));
  const big = fm_read(p('big.txt'), 10);
  assert.equal(big.data.truncated, true);
  assert.equal(big.data.bytes, 10);
  assert.equal(big.data.size, 100);
  assert.equal(fm_read(p('big.txt'), 100).data.truncated, false);   // exactly at the limit
});

test('append', (t) => {
  const p = tempDir(t);
  fm_create(p('a.txt'), 'one\n');
  assert.equal(fm_append(p('a.txt'), 'two\n').code, 'FM_OK');
  assert.equal(text(p('a.txt')), 'one\ntwo\n');

  // Missing file: error, and no file was created.
  assert.equal(fm_append(p('missing.txt'), 'x').code, 'FM_ERR_NOT_FOUND');
  assert.equal(fm_exists(p('missing.txt')), false);

  // No trailing newline: new text starts on its own line.
  fm_create(p('nonl.txt'), 'abc');
  fm_append(p('nonl.txt'), 'def');
  assert.equal(text(p('nonl.txt')), 'abc\ndef');
  if (IS_WIN) assert.equal(fs.readFileSync(p('nonl.txt'), 'utf8'), 'abc\r\ndef');

  // Empty file: no leading newline.
  fm_create(p('empty.txt'), '');
  fm_append(p('empty.txt'), 'x');
  assert.equal(text(p('empty.txt')), 'x');

  fm_create(p('ro.txt'), 'ro\n');
  fs.chmodSync(p('ro.txt'), 0o444);
  assert.equal(fm_append(p('ro.txt'), 'x').code, 'FM_ERR_PERMISSION');
  assert.equal(text(p('ro.txt')), 'ro\n');

  fs.mkdirSync(p('d'));
  assert.equal(fm_append(p('d'), 'x').code, 'FM_ERR_IS_DIR');
});

test('rename', (t) => {
  const p = tempDir(t);
  fm_create(p('a.txt'), 'A');
  assert.equal(fm_rename(p('a.txt'), p('b.txt')).code, 'FM_OK');
  assert.ok(!fm_exists(p('a.txt')) && fm_exists(p('b.txt')));

  // Node's rename would replace c.txt: this must be refused and both files kept.
  fm_create(p('c.txt'), 'C');
  assert.equal(fm_rename(p('b.txt'), p('c.txt')).code, 'FM_ERR_EXISTS');
  assert.equal(text(p('b.txt')), 'A');
  assert.equal(text(p('c.txt')), 'C');

  assert.equal(fm_rename(p('nope.txt'), p('x.txt')).code, 'FM_ERR_NOT_FOUND');
  assert.equal(fm_rename(p('b.txt'), p('nodir', 'b.txt')).code, 'FM_ERR_NOT_FOUND');
  assert.equal(fm_rename(p('b.txt'), p('bad?.txt')).code, 'FM_ERR_INVALID_NAME');

  // Case-only rename is allowed (Windows sees the source itself as "existing").
  assert.equal(fm_rename(p('c.txt'), p('C.txt')).code, 'FM_OK');
  assert.ok(fs.readdirSync(p()).includes('C.txt'));

  const same = fm_rename(p('b.txt'), p('b.txt'));
  assert.equal(same.code, 'FM_OK');
  assert.equal(same.data.unchanged, true);
});

test('delete', (t) => {
  const p = tempDir(t);
  fm_create(p('a.txt'), 'A');
  assert.equal(fm_delete(p('a.txt')).code, 'FM_OK');
  assert.equal(fm_exists(p('a.txt')), false);
  assert.equal(fm_delete(p('a.txt')).code, 'FM_ERR_NOT_FOUND');

  fs.mkdirSync(p('d'));
  assert.equal(fm_delete(p('d')).code, 'FM_ERR_IS_DIR');
  assert.ok(fm_exists(p('d')));

  // unlink on Windows would clear the read-only flag and delete: the file must survive.
  fm_create(p('ro.txt'), 'R');
  fs.chmodSync(p('ro.txt'), 0o444);
  assert.equal(fm_delete(p('ro.txt')).code, 'FM_ERR_PERMISSION');
  assert.ok(fm_exists(p('ro.txt')));

  // A link to a folder is a folder: not deleted, target untouched.
  fs.mkdirSync(p('target'));
  fm_create(p('target', 'keep.txt'), 'k');
  fs.symlinkSync(p('target'), p('link'), 'junction');
  assert.equal(fm_delete(p('link')).code, 'FM_ERR_IS_DIR');
  assert.ok(fm_exists(p('link')) && fm_exists(p('target', 'keep.txt')));
});

test('info', (t) => {
  const p = tempDir(t);
  const before = Date.now();
  fm_create(p('i.txt'), '12345');
  const r = fm_get_info(p('i.txt'));
  assert.equal(r.code, 'FM_OK');
  assert.equal(r.data.size, 5);
  assert.equal(r.data.name, 'i.txt');
  assert.ok(Math.abs(r.data.mtimeMs - before) < 5000);
  assert.equal(r.data.isReadOnly, false);
  fs.chmodSync(p('i.txt'), 0o444);
  assert.equal(fm_get_info(p('i.txt')).data.isReadOnly, true);
  assert.equal(fm_get_info(p('none.txt')).code, 'FM_ERR_NOT_FOUND');
  assert.equal(fm_get_info(p()).data.isDir, true);
});

test('no descriptor leak over 1000 create/delete cycles', (t) => {
  const p = tempDir(t);
  for (let i = 0; i < 1000; i++) {
    assert.equal(fm_create(p('loop.txt'), 'x\n').code, 'FM_OK');
    assert.equal(fm_read(p('loop.txt')).code, 'FM_OK');
    assert.equal(fm_append(p('loop.txt'), 'y').code, 'FM_OK');
    assert.equal(fm_delete(p('loop.txt')).code, 'FM_OK');
  }
});
