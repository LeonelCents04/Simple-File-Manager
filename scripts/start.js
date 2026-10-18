// start.js - starts the app even when ELECTRON_RUN_AS_NODE is set. Some editor terminals
// (VS Code's) set it, which makes Electron act as plain Node and no window opens.
import { spawn } from 'node:child_process';
import electron from 'electron';   // the package exports the path to the Electron binary

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
