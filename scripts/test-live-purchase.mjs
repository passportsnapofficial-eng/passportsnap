import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || 'https://passportsnap.vercel.app';
const TEST_EMAIL = 'kennedyabu85@gmail.com';
const TEST_FIRST_NAME = 'Kennedy';
const TEST_LAST_NAME = 'Abubakar';
const TEST_FULL_NAME = 'Kennedy Abubakar';
const TEST_PHONE = '0202337612';
const TEST_CART = [
  {
    id: 'e2e-us-passport-1',
    resultId: 'e2e-result-1',
    documentId: 'us-passport',
    documentName: 'U.S. Passport',
    countryLabel: 'United States',
    sizeLabel: '2 x 2 in',
    outputLabel: 'Digital image',
    flagPath: '/flags/us.svg',
    backgroundLabel: 'White',
    basePrice: 1,
    photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEA8QDw8QDw8QDw8QDw8QEA8QFREWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAQMC/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAB6AAAAP/EABQQAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEAAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQIBAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQMBAT8Af//Z',
    sourcePhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEA8QDw8QDw8QDw8QDw8QEA8QFREWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAQMC/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAB6AAAAP/EABQQAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEAAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQIBAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQMBAT8Af//Z',
    outputWidth: 600,
    outputHeight: 600,
    statusLabel: 'Ready',
    backgroundRemovalApplied: false,
    requiresPremiumRetouch: false,
    addedAt: new Date().toISOString(),
  },
];

function log(step, value = '') {
  console.log(`[live-purchase] ${step}${value ? `: ${value}` : ''}`);
}

async function fillIfVisible(page, selector, value) {
  const locator = page.locator(selector);
  if (await locator.count()) {
    await locator.first().fill(value);
  }
}

async function clickByText(page, text) {
  const button = page.getByRole('button', { name: text });
  await button.first().click();
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[browser-console-error] ${msg.text()}`);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/stripe/verify')) {
      return;
    }

    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '';
    }

    console.log(`[verify-response] ${response.status()} ${url} ${body.slice(0, 500)}`);
  });

  await context.addInitScript(({ cart }) => {
    if (!window.sessionStorage.getItem('ps_e2e_seeded')) {
      window.localStorage.setItem('ps_cart', JSON.stringify(cart));
      window.localStorage.setItem('ps_cart_options', JSON.stringify({
        photoPackage: 'digital',
        printCopies: 2,
        complianceCheck: false,
        photoRetouching: false,
        premiumRetouch: false,
      }));
      window.localStorage.removeItem('ps_pending_payment');
      window.localStorage.removeItem('ps_orders');
      window.sessionStorage.setItem('ps_e2e_seeded', 'true');
    }
  }, { cart: TEST_CART });

  log('open checkout');
  await page.goto(`${APP_URL}/checkout`, { waitUntil: 'networkidle' });

  await page.getByText('Choose your package').waitFor({ timeout: 30000 });
  await clickByText(page, 'Continue');
  await page.getByText('Upgrade your order').waitFor({ timeout: 30000 });
  await clickByText(page, 'Continue');
  await page.getByText('Contact & Delivery').waitFor({ timeout: 30000 });

  log('fill checkout details');
  await page.locator('input[placeholder="First name"]').fill(TEST_FIRST_NAME);
  await page.locator('input[placeholder="Last name"]').fill(TEST_LAST_NAME);
  await page.locator('input[placeholder="you@example.com"]').fill(TEST_EMAIL);
  await fillIfVisible(page, 'input[type="email"][placeholder="delivery@example.com"]', TEST_EMAIL);
  await fillIfVisible(page, 'input[type="tel"]', TEST_PHONE);

  await clickByText(page, 'Pay now');

  log('wait stripe');
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '.codex-logs/stripe-opened.png', fullPage: true });
  const stripeState = await page.evaluate(() => ({
    bodyText: document.body.innerText.slice(0, 2000),
    visibleCardButtons: Array.from(document.querySelectorAll('button[aria-label="Pay with card"], button[data-testid="card-accordion-item-button"]'))
      .map((button) => {
        if (!(button instanceof HTMLElement)) return null;
        const rect = button.getBoundingClientRect();
        return {
          text: button.innerText,
          aria: button.getAttribute('aria-label'),
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter(Boolean),
  }));
  log('stripe state', JSON.stringify(stripeState));

  await fillIfVisible(page, 'input[name="email"]', TEST_EMAIL);
  await fillIfVisible(page, 'input[type="tel"]', TEST_PHONE);
  const cardNumberVisible = await page.locator('input[autocomplete="cc-number"]').isVisible().catch(() => false);
  if (!cardNumberVisible) {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-label="Pay with card"], button[data-testid="card-accordion-item-button"]'));
      const target = buttons.find((button) => {
        if (!(button instanceof HTMLElement)) return false;
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) || buttons[0];

      if (target instanceof HTMLElement) {
        target.click();
      }
    });
    await page.waitForTimeout(1500);
  }
  await page.waitForSelector('input[autocomplete="cc-number"]', { timeout: 30000 });
  await fillIfVisible(page, 'input[autocomplete="cc-number"]', '4242424242424242');
  await fillIfVisible(page, 'input[autocomplete="cc-exp"]', '1234');
  await fillIfVisible(page, 'input[autocomplete="cc-csc"]', '123');
  await fillIfVisible(page, 'input[autocomplete="cc-name"]', TEST_FULL_NAME);
  await fillIfVisible(page, 'input[autocomplete="billingName"]', TEST_FULL_NAME);

  const countrySelect = page.locator('select[name="billingCountry"]');
  if (await countrySelect.count()) {
    await countrySelect.selectOption('US');
  }

  await fillIfVisible(page, 'input[autocomplete="postal-code"]', '10001');
  await fillIfVisible(page, 'input[placeholder="ZIP"]', '10001');
  await page.screenshot({ path: '.codex-logs/stripe-before-submit.png', fullPage: true });

  await page.screenshot({ path: '.codex-logs/stripe-ready-to-pay.png', fullPage: true });
  const submitButton = page.locator('button[type="submit"]');
  if (await submitButton.count()) {
    await submitButton.last().click({ force: true });
  } else {
    await page.evaluate(() => {
      const button = document.querySelector('button[type="submit"]');
      if (button instanceof HTMLElement) {
        button.click();
      }
    });
  }

  log('wait redirect');
  try {
    await page.waitForURL(new RegExp(`${APP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), { timeout: 120000 });
  } catch (error) {
    await page.screenshot({ path: '.codex-logs/stripe-timeout.png', fullPage: true });
    log('stripe timeout url', page.url());
    log('stripe timeout title', await page.title());
    log('stripe timeout text', (await page.locator('body').innerText()).slice(0, 2000));
    throw error;
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(8000);

  const bodyText = await page.locator('body').innerText();
  const url = page.url();
  const title = await page.title();
  const storageState = await page.evaluate(() => ({
    pendingPayment: window.localStorage.getItem('ps_pending_payment'),
    orders: window.localStorage.getItem('ps_orders'),
    cart: window.localStorage.getItem('ps_cart'),
  }));
  const screenshotPath = 'playwright-live-purchase.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });

  log('final url', url);
  log('page title', title);
  log('body preview', bodyText.slice(0, 2000));
  log('storage state', JSON.stringify(storageState));
  log('contains success', String(bodyText.includes('Payment successful')));
  log('contains dashboard CTA', String(bodyText.includes('Create account or sign in') || bodyText.includes('Open dashboard')));
  log('contains email text', String(bodyText.includes('emailed') || bodyText.includes('email')));
  log('screenshot', screenshotPath);

  await browser.close();

  console.log(JSON.stringify({
    url,
    title,
    hasPaymentSuccessful: bodyText.includes('Payment successful'),
    hasDashboardCta: bodyText.includes('Create account or sign in') || bodyText.includes('Open dashboard'),
    hasEmailMessage: bodyText.includes('emailed') || bodyText.includes('email'),
    bodyPreview: bodyText.slice(0, 2000),
    storageState,
    screenshotPath,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
