import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..', 'src');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? files(path.join(dir, e.name)) : /\.(c?js)$/.test(e.name) ? [path.join(dir, e.name)] : []);

test('renderer never imports Node or Electron', () => {
  for (const f of files(path.join(root, 'renderer'))) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /from\s+['"](node:|fs|path|electron|child_process)/, f);
    assert.doesNotMatch(src, /require\(/, f);
  }
});

test('file logic never touches the UI or prints', () => {
  for (const f of [...files(path.join(root, 'main')).filter((x) => !/main\.js$|ipc\.js$/.test(x)), ...files(path.join(root, 'shared'))]) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /from\s+['"]electron['"]|console\.|document\.|window\./, f);
  }
});

test('no shell commands anywhere', () => {
  for (const f of files(root)) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /child_process|shell\.openPath/, f);
});
