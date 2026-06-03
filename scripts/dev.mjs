import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const viteBin = resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const apiServerEntry = resolve(rootDir, 'server', 'appServer.mjs');
const shouldRunLegacyAiService = process.argv.includes('--with-legacy-ai');
const shouldRunImageEnhancer = process.argv.includes('--with-image-enhancer');
const apiWatchTargets = [
  resolve(rootDir, 'server'),
  resolve(rootDir, 'src', 'lib', 'admin'),
  resolve(rootDir, 'src', 'lib', 'backgroundRemoval'),
  resolve(rootDir, 'src', 'lib', 'payments'),
  resolve(rootDir, 'src', 'lib', 'checkout'),
  resolve(rootDir, 'src', 'data'),
];

function shouldRestartApiForFile(filename = '') {
  const normalized = String(filename).replace(/\\/g, '/').toLowerCase();

  if (!normalized) return false;
  if (normalized.endsWith('admin-review-requests.json')) return false;
  if (normalized.endsWith('.log') || normalized.endsWith('.err')) return false;

  return true;
}

let isShuttingDown = false;
let apiRestartTimer = null;
let apiServer = null;
let aiService = null;
let imageEnhancerService = null;

function spawnChild(args) {
  return spawn(process.execPath, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
}

function stopChild(child) {
  if (child && !child.killed) {
    child.kill();
  }
}

function startAiService() {
  const child = spawn('python', ['-m', 'uvicorn', 'services.legacy.background_removal.main:app', '--host', '127.0.0.1', '--port', '8787'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (isShuttingDown) return;
    if (signal || code === 0) return;
    shutdown(code || 1);
  });

  return child;
}

function startImageEnhancerService() {
  const child = spawn('python', ['-m', 'uvicorn', 'services.image_enhancement.main:app', '--host', '127.0.0.1', '--port', '8788'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (isShuttingDown) return;
    if (signal || code === 0) return;
    shutdown(code || 1);
  });

  return child;
}

function startApiServer() {
  const child = spawnChild([apiServerEntry]);
  child.on('exit', (code, signal) => {
    if (isShuttingDown) return;
    if (signal || code === 0) return;
    shutdown(code || 1);
  });
  return child;
}

function scheduleApiRestart(reason = 'source update') {
  if (isShuttingDown) return;

  clearTimeout(apiRestartTimer);
  apiRestartTimer = setTimeout(() => {
    console.log(`[dev] restarting payment API after ${reason}`);
    stopChild(apiServer);
    apiServer = startApiServer();
  }, 120);
}

const viteServer = spawnChild([viteBin, '--host', '0.0.0.0', '--port', '5173']);
viteServer.on('exit', (code, signal) => {
  if (isShuttingDown) return;
  if (signal || code === 0) return;
  shutdown(code || 1);
});

apiServer = startApiServer();
if (shouldRunLegacyAiService) {
  aiService = startAiService();
}
if (shouldRunImageEnhancer) {
  imageEnhancerService = startImageEnhancerService();
}

const watchers = apiWatchTargets.map((targetPath) =>
  watch(targetPath, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    if (!shouldRestartApiForFile(filename)) return;
    scheduleApiRestart(filename);
  }),
);

function shutdown(exitCode = 0) {
  isShuttingDown = true;
  clearTimeout(apiRestartTimer);

  for (const watcher of watchers) {
    watcher.close();
  }

  stopChild(apiServer);
  stopChild(aiService);
  stopChild(imageEnhancerService);
  stopChild(viteServer);
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
