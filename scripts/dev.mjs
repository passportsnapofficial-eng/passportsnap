import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const viteBin = resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const apiServerEntry = resolve(rootDir, 'server', 'paystackServer.mjs');

const children = [
  spawn(process.execPath, [apiServerEntry], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(process.execPath, [viteBin, '--host', '0.0.0.0', '--port', '5173'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  }),
];

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(exitCode);
}

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
