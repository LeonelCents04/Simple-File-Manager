import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fs_list, fs_drives } from '../src/main/fs_scan.js';
import { fm_create } from '../src/main/file_ops.js';
import { tempDir } from './helpers.js';

test('folders first, then files, A-Z ignoring case', (t) => {
  const p = tempDir(t);
  fm_create(p('b.txt'), 'bb');
  fm_create(p('A.txt'), 'a');
  fm_create(p('Z.md'), '');
  fs.mkdirSync(p('Dsub'));
  fs.mkdirSync(p('c'));
  fm_create(p('.hidden'), 'h');

  const r = fs_list(p());
  assert.equal(r.code, 'FM_OK');
  assert.deepEqual(r.data.map((e) => e.name), ['c', 'Dsub', 'A.txt', 'b.txt', 'Z.md']);
  assert.equal(r.data[0].isDir, true);
  assert.equal(r.data[2].isDir, false);
  assert.equal(r.data.find((e) => e.name === 'b.txt').size, 2);
  assert.equal(fs_list(p('missing')).code, 'FM_ERR_NOT_FOUND');
});

test('entries stat cannot read are still listed', (t) => {
  const p = tempDir(t);
  fs.mkdirSync(p('gone'));
  fs.symlinkSync(p('gone'), p('dangling'), 'junction');
  fs.rmdirSync(p('gone'));   // the junction now points nowhere
  const e = fs_list(p()).data.find((x) => x.name === 'dangling');
  assert.ok(e, 'dangling entry listed');
  assert.equal(e.size, 0);
});

test('drives: the drive we are running on is listed, with sane sizes', async () => {
  const r = await fs_drives();
  assert.equal(r.code, 'FM_OK');
  const root = path.parse(process.cwd()).root;
  const d = r.data.find((x) => x.path.toLowerCase() === root.toLowerCase());
  assert.ok(d, 'current drive ' + root + ' listed in ' + JSON.stringify(r.data.map((x) => x.path)));
  assert.equal(d.label, root.length > 1 ? root.slice(0, -1) : root);   // "C:" for "C:\"
  assert.ok(d.total > 0 && d.free >= 0 && d.free <= d.total);
  assert.equal(fs_list(d.path).code, 'FM_OK');                       // and it can be opened
});
