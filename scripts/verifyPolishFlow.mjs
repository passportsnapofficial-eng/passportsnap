import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = resolve(rootDir, '.codex-logs', 'flow-polish-checks');
const debugBase = process.env.CDP_DEBUG_BASE || 'http://127.0.0.1:9222';
const APP_BASE = 'http://127.0.0.1:5173';
const API_BASE = 'http://127.0.0.1:8790';
const GOOD_IMAGE_CANDIDATES = [
  resolve(rootDir, 'Test', 'WhatsApp Image 2026-04-07 at 11.23.51 PM.jpeg'),
  resolve(rootDir, 'Test', 'WhatsApp Image 2026-04-07 at 11.23.52 PM (3).jpeg'),
];
const FAIL_IMAGE_CANDIDATES = [
  resolve(rootDir, 'Test', 'WhatsApp Image 2026-04-08 at 12.14.41 PM (1).jpeg'),
  resolve(rootDir, 'Test', 'WhatsApp Image 2026-04-07 at 11.06.38 PM.jpeg'),
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

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.id) return;

    const handler = pending.get(payload.id);
    if (!handler) return;

    pending.delete(payload.id);

    if (payload.error) {
      handler.reject(new Error(payload.error.message || 'CDP request failed.'));
      return;
    }

    handler.resolve(payload.result);
  });

  const opened = new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', () => rejectOpen(new Error('Could not connect to the CDP websocket.')), { once: true });
  });

  return {
    opened,
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

async function openClient(url, { width = 390, height = 844 } = {}) {
  const target = await createTarget(url);
  const client = createCdpClient(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await client.send('Page.navigate', { url });
  await waitForLoad(client);
  return client;
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

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });

  return result.result.value;
}

async function waitForCondition(client, expression, label, timeoutMs = 60000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(client, expression);
    if (value) {
      return value;
    }

    await delay(300);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function clickButtonByText(client, text) {
  const clicked = await evaluate(client, `(() => {
    const target = Array.from(document.querySelectorAll('button'))
      .find((button) => button.offsetParent !== null && (button.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});

    if (!target) {
      return false;
    }

    target.click();
    return true;
  })()`);

  if (!clicked) {
    throw new Error(`Could not find button: ${text}`);
  }

  await delay(250);
}

async function clickButtonContainingText(client, text) {
  const clicked = await evaluate(client, `(() => {
    const target = Array.from(document.querySelectorAll('button'))
      .find((button) => button.offsetParent !== null && (button.innerText || '').replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)}));

    if (!target) {
      return false;
    }

    target.click();
    return true;
  })()`);

  if (!clicked) {
    throw new Error(`Could not find button containing: ${text}`);
  }

  await delay(250);
}

async function setFileInputFiles(client, selector, files) {
  const { root } = await client.send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await client.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector,
  });

  if (!nodeId) {
    throw new Error(`Could not find file input: ${selector}`);
  }

  await client.send('DOM.setFileInputFiles', {
    nodeId,
    files,
  });

  await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) {
      return false;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input.files?.length || 0;
  })()`);
}

async function setInputValue(client, selector, value) {
  const success = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) {
      return false;
    }

    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor.set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);

  if (!success) {
    throw new Error(`Could not set input: ${selector}`);
  }
}

async function captureScreenshot(client, filename) {
  await mkdir(outputDir, { recursive: true });
  const filePath = resolve(outputDir, filename);
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  await writeFile(filePath, Buffer.from(screenshot.data, 'base64'));
  return filePath;
}

async function collectReviewState(client) {
  return evaluate(client, `JSON.stringify((() => ({
    path: location.pathname,
    text: document.body.innerText,
    hasDownloadButton: Array.from(document.querySelectorAll('button')).some((button) => button.offsetParent !== null && (button.innerText || '').trim() === 'Download'),
    hasRetakeButton: Array.from(document.querySelectorAll('button')).some((button) => button.offsetParent !== null && (button.innerText || '').trim() === 'Retake Photo'),
    logoSrc: document.querySelector('header img')?.getAttribute('src') || '',
  }))())`);
}

async function runUploadReviewCase(filePath) {
  const client = await openClient(`${APP_BASE}/capture`);
  await clickButtonByText(client, 'Upload image mode');
  await setFileInputFiles(client, 'input[type="file"]', [filePath]);
  await waitForCondition(client, `Array.from(document.querySelectorAll('button')).some((button) => button.offsetParent !== null && (button.innerText || '').trim() === 'Use This Photo')`, 'selected photo CTA');
  await clickButtonByText(client, 'Use This Photo');
  await waitForCondition(client, `location.pathname === '/review' && Boolean(document.querySelector('img[alt="Finished passport photo"]'))`, 'review page');
  const serialized = await collectReviewState(client);
  return {
    client,
    filePath,
    reviewState: JSON.parse(serialized),
  };
}

async function verifyHomeHeader() {
  const client = await openClient(`${APP_BASE}/`);

  const topState = JSON.parse(await evaluate(client, `JSON.stringify((() => {
    const header = document.querySelector('header');
    const styles = getComputedStyle(header);
    return {
      position: styles.position,
      backgroundColor: styles.backgroundColor,
      backgroundImage: styles.backgroundImage,
      logoSrc: header?.querySelector('img')?.getAttribute('src') || '',
      startButtonText: Array.from(document.querySelectorAll('button')).find((button) => (button.innerText || '').trim() === 'Start Photo')?.innerText || '',
    };
  })())`));

  await captureScreenshot(client, 'home-header-top.png');
  await evaluate(client, 'window.scrollTo(0, 260); true;');
  await delay(600);

  const stickyState = JSON.parse(await evaluate(client, `JSON.stringify((() => {
    const header = document.querySelector('header');
    const styles = getComputedStyle(header);
    return {
      position: styles.position,
      backgroundColor: styles.backgroundColor,
      logoSrc: header?.querySelector('img')?.getAttribute('src') || '',
    };
  })())`));

  await captureScreenshot(client, 'home-header-sticky.png');
  client.close();

  if (topState.position !== 'sticky') {
    throw new Error('Header is not sticky on the home page.');
  }

  if (!topState.logoSrc.includes('logo-white')) {
    throw new Error('Home header does not use the white logo at the top state.');
  }

  if (!topState.backgroundImage || topState.backgroundImage === 'none') {
    throw new Error('Home header lost the dark navy top-state treatment.');
  }

  if (!stickyState.logoSrc.includes('logo-black')) {
    throw new Error('Sticky header does not switch to the black logo.');
  }

  if (!stickyState.backgroundColor.includes('255, 255, 255')) {
    throw new Error('Sticky header did not switch to white.');
  }

  return { topState, stickyState };
}

async function verifyDashboardGate() {
  const client = await openClient(`${APP_BASE}/dashboard`);
  const bodyText = await evaluate(client, 'document.body.innerText');
  await captureScreenshot(client, 'dashboard-gate.png');
  client.close();

  if (!bodyText.includes('Sign in to open your dashboard')) {
    throw new Error('Dashboard guest gate is missing.');
  }

  return { gated: true };
}

async function findPassingReviewCase() {
  const attempts = [];

  for (const filePath of GOOD_IMAGE_CANDIDATES) {
    const run = await runUploadReviewCase(filePath);
    attempts.push({ filePath, path: run.reviewState.path, hasDownloadButton: run.reviewState.hasDownloadButton });

    if (run.reviewState.hasDownloadButton) {
      await clickButtonByText(run.client, 'Download');
      await waitForCondition(
        run.client,
        `document.body.innerText.includes('Save orders to a real account') && Boolean(document.querySelector('input[name="email"]'))`,
        'auth dialog after download',
      );
      const authDialogPath = await captureScreenshot(run.client, 'review-auth-gate.png');
      run.client.close();
      return {
        filePath,
        authDialogPath,
        attempts,
      };
    }

    run.client.close();
  }

  throw new Error(`No passing review case produced a download CTA. Attempts: ${JSON.stringify(attempts)}`);
}

async function findFailingReviewCase() {
  const attempts = [];

  for (const filePath of FAIL_IMAGE_CANDIDATES) {
    const run = await runUploadReviewCase(filePath);
    const bodyText = run.reviewState.text || '';
    const hasFixText = bodyText.includes("Let's fix this:");
    const hasNextSelfieText = bodyText.includes('For the next selfie');
    attempts.push({ filePath, hasFixText, hasNextSelfieText, hasDownloadButton: run.reviewState.hasDownloadButton });

    if (hasFixText && hasNextSelfieText && !run.reviewState.hasDownloadButton) {
      const screenshotPath = await captureScreenshot(run.client, 'review-fail-guidance.png');
      run.client.close();
      return {
        filePath,
        screenshotPath,
        attempts,
      };
    }

    run.client.close();
  }

  throw new Error(`No failing review case showed the updated guidance. Attempts: ${JSON.stringify(attempts)}`);
}

async function verifyStripeInitialize() {
  const response = await fetch(`${API_BASE}/api/stripe/initialize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'flow-check@example.com',
      firstName: 'Flow',
      lastName: 'Check',
      phone: '+15555550123',
      cartItems: [{ documentId: 'us-passport' }],
      premiumRetouch: false,
      returnUrl: `${APP_BASE}/`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Stripe initialize request failed.');
  }

  if (!payload.sessionId || !payload.checkoutUrl || !payload.orderReference) {
    throw new Error('Stripe initialize response is missing required fields.');
  }

  return {
    sessionIdPresent: Boolean(payload.sessionId),
    checkoutUrlPresent: Boolean(payload.checkoutUrl),
    orderReferencePresent: Boolean(payload.orderReference),
  };
}

async function main() {
  const header = await verifyHomeHeader();
  const dashboard = await verifyDashboardGate();
  const passCase = await findPassingReviewCase();
  const failCase = await findFailingReviewCase();
  const stripe = await verifyStripeInitialize();

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    header,
    dashboard,
    passCase,
    failCase,
    stripe,
  }, null, 2));
}

await main();
