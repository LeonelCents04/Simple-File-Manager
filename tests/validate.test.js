import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fm_validate_path, fm_resolve_input } from '../src/main/validate.js';

const msg = (s) => fm_validate_path(s).detail;

test('section 8: one message per rule', () => {
  assert.equal(msg(''), 'The name is empty.');
  assert.equal(msg('   '), 'The name is empty.');
  assert.equal(msg('D:'), 'A drive is not a file name.');
  assert.equal(msg('docs\\'), 'The path ends with "\\", so there is no file name.');
  assert.equal(msg('docs/'), 'The path ends with "\\", so there is no file name.');
  assert.equal(msg('.'), '"." is not a valid file name.');
  assert.equal(msg('docs\\..'), '".." is not a valid file name.');
  assert.equal(msg('x'.repeat(256)), 'A name part is longer than 255 characters.');
  assert.equal(msg('a?b.txt'), 'The character "?" is not allowed in file names.');
  assert.equal(msg('a<b'), 'The character "<" is not allowed in file names.');
  assert.equal(msg('D:notes.txt'), 'The character ":" is not allowed in file names.');
  assert.equal(msg('a\tb'), 'The character "control code" is not allowed in file names.');
  assert.equal(msg('a\u0000b'), 'The character "control code" is not allowed in file names.');
  assert.equal(msg('name.'), 'Names cannot end with a space or a dot.');
  assert.equal(msg('name '), 'Names cannot end with a space or a dot.');
  assert.equal(msg('CON'), '"CON" is a reserved Windows device name.');
  assert.equal(msg('con.txt'), '"con.txt" is a reserved Windows device name.');
  assert.equal(msg('LPT9'), '"LPT9" is a reserved Windows device name.');

  const long = fm_validate_path('a\\'.repeat(130) + 'b');
  assert.equal(long.code, 'FM_ERR_PATH_TOO_LONG');
  assert.equal(long.detail, 'That path is 260 characters or longer.');
  assert.equal(fm_validate_path(42).code, 'FM_ERR_INVALID_ARG');
});

test('accepted forms', () => {
  for (const s of ['notes.txt', 'sub\\notes.txt', '..\\notes.txt', 'D:\\Projects\\notes.txt', 'sub/notes.txt', 'console.txt', 'COM0'])
    assert.equal(fm_validate_path(s).code, 'FM_OK', s);
});

test('resolve against the folder shown', () => {
  assert.equal(fm_resolve_input('notes.txt', 'D:\\Projects\\demo').data.path, 'D:\\Projects\\demo\\notes.txt');
  assert.equal(fm_resolve_input('..\\x.txt', 'D:\\Projects\\demo').data.path, 'D:\\Projects\\x.txt');
  assert.equal(fm_resolve_input('docs/a.txt', 'D:\\p').data.path, 'D:\\p\\docs\\a.txt');
  assert.equal(fm_resolve_input('C:\\abs.txt', 'D:\\p').data.path, 'C:\\abs.txt');
  const deep = fm_resolve_input('y'.repeat(200) + '.txt', 'D:\\' + 'z'.repeat(80));
  assert.equal(deep.code, 'FM_ERR_PATH_TOO_LONG');
  assert.equal(fm_resolve_input('a?.txt', 'D:\\p').code, 'FM_ERR_INVALID_NAME');
});
