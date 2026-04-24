import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = resolve(rootDir, '.codex-logs', 'ui-checks');
const debugBase = process.env.CDP_DEBUG_BASE || 'http://127.0.0.1:9222';

const VIEWPORT_CASES = [
  {
    id: 'home-iphone',
    url: 'http://127.0.0.1:5173/',
    width: 390,
    height: 844,
  },
  {
    id: 'capture-iphone',
    url: 'http://127.0.0.1:5173/capture',
    width: 390,
    height: 844,
  },
  {
    id: 'capture-android-small',
    url: 'http://127.0.0.1:5173/capture',
    width: 360,
    height: 740,
  },
];

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

async function createTarget(url) {
  const response = await fetch(`${debugBase}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });

  if (!response.ok) {
    throw new Error(`Could not create browser target: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);

    if (payload.id) {
      const handler = pending.get(payload.id);
      if (!handler) {
        return;
      }

      pending.delete(payload.id);

      if (payload.error) {
        handler.reject(new Error(payload.error.message || 'CDP request failed.'));
        return;
      }

      handler.resolve(payload.result);
      return;
    }

    const handlers = listeners.get(payload.method) || [];
    handlers.forEach((handler) => handler(payload.params || {}));
  });

  const opened = new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', () => rejectOpen(new Error('Could not connect to CDP websocket.')), { once: true });
  });

  return {
    opened,
    on(method, handler) {
      const current = listeners.get(method) || [];
      current.push(handler);
      listeners.set(method, current);
    },
    async send(method, params = {}) {
      await opened;
      const id = nextId++;

      const result = new Promise((resolveResult, rejectResult) => {
        pending.set(id, { resolve: resolveResult, reject: rejectResult });
      });

      socket.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() {
      socket.close();
    },
  };
}

async function waitForLoad(client, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const state = await client.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });

    if (state.result.value === 'complete') {
      await delay(600);
      return;
    }

    await delay(250);
  }

  throw new Error('Timed out waiting for page load.');
}

async function captureScreenshot(client, path) {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });

  await writeFile(path, Buffer.from(result.data, 'base64'));
}

async function inspectCase(entry) {
  const target = await createTarget(entry.url);
  const client = createCdpClient(target.webSocketDebuggerUrl);
  const consoleMessages = [];
  const exceptions = [];

  client.on('Runtime.consoleAPICalled', (params) => {
    const text = (params.args || [])
      .map((arg) => arg.value ?? arg.description ?? '')
      .join(' ')
      .trim();

    if (text) {
      consoleMessages.push({
        type: params.type,
        text,
      });
    }
  });

  client.on('Runtime.exceptionThrown', (params) => {
    exceptions.push(params.exceptionDetails?.text || params.exceptionDetails?.exception?.description || 'Unknown exception');
  });

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: entry.width,
    height: entry.height,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await client.send('Page.navigate', { url: entry.url });
  await waitForLoad(client);

  const evaluation = await client.send('Runtime.evaluate', {
    expression: `JSON.stringify((() => {
      const header = document.querySelector('header');
      const headerStyles = header ? getComputedStyle(header) : null;
      const buttons = Array.from(document.querySelectorAll('main button'))
        .filter((button) => button.offsetParent !== null)
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            text: (button.innerText || '').trim(),
            width: Math.round(rect.width),
            parentWidth: Math.round(button.parentElement?.getBoundingClientRect().width || 0),
          };
        });

      return {
        bodyLength: document.body.innerText.trim().length,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        captureButtonVisible: Boolean(document.querySelector('[aria-label="Capture photo"]')),
        header: headerStyles ? {
          position: headerStyles.position,
          top: headerStyles.top,
          backgroundColor: headerStyles.backgroundColor,
          backdropFilter: headerStyles.backdropFilter || headerStyles.webkitBackdropFilter || '',
          borderBottomColor: headerStyles.borderBottomColor,
        } : null,
        buttons,
      };
    })())`,
    returnByValue: true,
  });

  await mkdir(outputDir, { recursive: true });
  const screenshotPath = resolve(outputDir, `${entry.id}.png`);
  await captureScreenshot(client, screenshotPath);
  client.close();

  return {
    ...entry,
    screenshotPath,
    consoleMessages,
    exceptions,
    ...(JSON.parse(evaluation.result.value || '{}')),
  };
}

async function main() {
  const results = [];

  for (const entry of VIEWPORT_CASES) {
    results.push(await inspectCase(entry));
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    results,
  }, null, 2));
}

await main();
