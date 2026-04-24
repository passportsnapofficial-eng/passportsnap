const debugBase = process.env.CDP_DEBUG_BASE || 'http://127.0.0.1:9222';
const pageUrl = process.argv[2] || 'http://127.0.0.1:5173/validation-lab.html';
const timeoutMs = Number(process.env.VALIDATION_LAB_TIMEOUT_MS || 30000);

const WebSocketImpl = globalThis.WebSocket;

if (!WebSocketImpl) {
  throw new Error('WebSocket is unavailable in this Node runtime.');
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
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
  const socket = new WebSocketImpl(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);

    if (payload.id) {
      const handler = pending.get(payload.id);
      if (!handler) return;
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

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Could not connect to CDP websocket.')), { once: true });
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

      const result = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });

      socket.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() {
      socket.close();
    },
  };
}

async function main() {
  const target = await createTarget(pageUrl);
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
  await client.send('Page.navigate', { url: pageUrl });

  const startedAt = Date.now();
  let complete = false;
  let summary = null;
  let errorMessage = null;
  let payloadStage = null;
  let payloadErrorDetail = null;

  while (Date.now() - startedAt < timeoutMs) {
    const state = await client.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        complete: Boolean(window.__validationLabComplete),
        summary: window.__validationLabSummary || null,
        error: window.__validationLabError || null,
        errorDetail: window.__validationLabErrorDetail || null,
        stage: window.__validationLabStage || null
      })`,
      returnByValue: true,
    });

    const value = JSON.parse(state.result.value);
    complete = Boolean(value.complete);
    summary = value.summary;
    errorMessage = value.error;
    payloadStage = value.stage;
    payloadErrorDetail = value.errorDetail;

    if (complete) {
      break;
    }

    await delay(500);
  }

  const dom = await client.send('Runtime.evaluate', {
    expression: 'document.body.innerText',
    returnByValue: true,
  });

  const payload = {
    complete,
    summary,
    errorMessage,
    stage: payloadStage,
    errorDetail: payloadErrorDetail,
    consoleMessages,
    exceptions,
    bodyText: dom.result.value,
  };

  console.log(JSON.stringify(payload, null, 2));
  client.close();

  if (!complete) {
    process.exitCode = 2;
    return;
  }

  if (errorMessage) {
    process.exitCode = 3;
    return;
  }
}

await main();
