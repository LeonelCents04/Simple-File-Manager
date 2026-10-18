import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  js.configs.recommended,
  { files: ['src/main/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', 'eslint.config.js'], languageOptions: { globals: globals.node } },
  { files: ['src/preload/**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
  { files: ['src/shared/**/*.js'], languageOptions: { globals: { TextEncoder: 'readonly' } } },
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: { globals: globals.browser },
    // The renderer is sandboxed: it reaches files only through window.fm.
    rules: { 'no-restricted-imports': ['error', { patterns: ['node:*', 'fs', 'path', 'electron', 'child_process'] }] },
  },
];
