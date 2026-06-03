/**
 * Full end-to-end suite for PassportSnap.
 *
 * Drives the real built app served by appServer (--serve-dist) on a single
 * origin so the Stripe return URL (127.0.0.1:8790) matches. Covers:
 *   A. Static-route smoke (home, about, privacy, terms, cart, dashboard, document)
 *   B. Guest purchase: seeded digital cart -> Stripe test card -> success
 *   C. Guest purchase: seeded digital + printouts (US address) -> Stripe -> success
 *   D. Real photo pipeline: /capture -> upload fixture -> process -> review
 *   E. Admin dashboard: login admin/admin -> overview metrics -> tab tour
 *   F. Dashboard logged-out state + auth dialog
 *
 * Each journey captures console errors, page errors, failed /api responses,
 * and screenshots. Results are written to .codex-logs/e2e/report.json.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const APP_URL = (process.env.APP_URL || 'http://127.0.0.1:8790').replace(/\/$/, '');
const OUT_DIR = resolve(ROOT, '.codex-logs', 'e2e');
const FIXTURES = resolve(ROOT, 'public', 'test-fixtures');
const STRIPE_CARD = '4242424242424242';
const TEST_EMAIL = 'passportsnap.e2e@example.com';
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);

mkdirSync(OUT_DIR, { recursive: true });

const results = [];
function record(journey, status, details = {}) {
  results.push({ journey, status, ...details });
  const icon = status === 'pass' ? 'PASS' : status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[${icon}] ${journey}${details.note ? ' - ' + details.note : ''}`);
}

const DIGITAL_ITEM = {
  id: 'e2e-us-passport',
  resultId: 'e2e-result-1',
  documentId: 'us-passport',
  documentName: 'U.S. Passport',
  countryLabel: 'United States',
  sizeLabel: '2 x 2 in',
  outputLabel: 'Digital image',
  flagPath: '/flags/us.svg',
  backgroundLabel: 'White',
  basePrice: 12.95,
  photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEA8QDw8QDw8QDw8QDw8QEA8QFREWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAQMC/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAB6AAAAP/EABQQAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEAAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQIBAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQMBAT8Af//Z',
  sourcePhoto: '',
  outputWidth: 600,
  outputHeight: 600,
  statusLabel: 'Ready',
  backgroundRemovalApplied: false,
  requiresPremiumRetouch: false,
  addedAt: new Date().toISOString(),
};

function attachDiagnostics(page, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => bucket.pageErrors.push(String(err).slice(0, 300)));
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/') && res.status() >= 400) {
      bucket.apiErrors.push(`${res.status()} ${res.request().method()} ${url.replace(APP_URL, '')}`);
    }
  });
}

function newDiagBucket() {
  return { consoleErrors: [], pageErrors: [], apiErrors: [] };
}

async function shot(page, name) {
  const safe = String(name).replace(/[^a-z0-9._-]+/gi, '-');
  const path = resolve(OUT_DIR, `${safe}.png`);
  try { await page.screenshot({ path, fullPage: true }); } catch { /* page may be on stripe */ }
  return path;
}

async function seedCart(context, item, options) {
  await context.addInitScript(({ cartItem, cartOptions }) => {
    window.localStorage.setItem('ps_cart', JSON.stringify([cartItem]));
    window.localStorage.setItem('ps_cart_options', JSON.stringify(cartOptions));
    window.localStorage.removeItem('ps_pending_payment');
    window.localStorage.removeItem('ps_orders');
  }, { cartItem: item, cartOptions: options });
}

async function fillIfVisible(page, selector, value) {
  const loc = page.locator(selector);
  if (await loc.count()) {
    try { await loc.first().fill(value, { timeout: 4000 }); return true; } catch { return false; }
  }
  return false;
}

// ---- Stripe hosted checkout automation (test mode) ----
async function payOnStripe(page, label) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3500);
  await shot(page, `${label}-stripe-loaded`);

  await fillIfVisible(page, 'input[name="email"]', TEST_EMAIL);

  // Reveal the card form if it is behind an accordion / wallet selector.
  const cardVisible = await page.locator('input[autocomplete="cc-number"]').isVisible().catch(() => false);
  if (!cardVisible) {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll(
        'button[aria-label="Pay with card"], button[data-testid="card-accordion-item-button"], #card-tab, [data-testid="card-tab"]'
      ));
      const target = buttons.find((b) => b instanceof HTMLElement && b.getBoundingClientRect().width > 0) || buttons[0];
      if (target instanceof HTMLElement) target.click();
    });
    await page.waitForTimeout(1500);
  }

  await page.waitForSelector('input[autocomplete="cc-number"]', { timeout: 30000 });
  await fillIfVisible(page, 'input[autocomplete="cc-number"]', STRIPE_CARD);
  await fillIfVisible(page, 'input[autocomplete="cc-exp"]', '1234');
  await fillIfVisible(page, 'input[autocomplete="cc-csc"]', '123');
  await fillIfVisible(page, 'input[autocomplete="cc-name"]', 'E2E Tester');
  await fillIfVisible(page, 'input[autocomplete="billingName"]', 'E2E Tester');

  const country = page.locator('select[name="billingCountry"]');
  if (await country.count()) { try { await country.selectOption('US'); } catch { /* maybe preset */ } }
  // ZIP/postal field selectors vary across Stripe Checkout versions.
  for (const sel of [
    'input[name="billingPostalCode"]', '#billingPostalCode',
    'input[autocomplete="postal-code"]', 'input[placeholder="ZIP"]',
    'input[placeholder="ZIP code"]', 'input[aria-label="ZIP"]',
  ]) {
    if (await fillIfVisible(page, sel, '10001')) break;
  }
  await page.waitForTimeout(500);
  await shot(page, `${label}-stripe-filled`);

  // Click the form "Pay" button (NOT the green "Pay with Link" wallet button).
  const payBtn = page.getByRole('button', { name: /^Pay$|Pay \$|Pay US/i });
  if (await payBtn.count()) {
    await payBtn.last().click({ force: true });
  } else {
    const submit = page.locator('button[type="submit"]');
    if (await submit.count()) await submit.last().click({ force: true });
  }

  // Wait for redirect back to the app, capturing a Stripe-side error if it stalls.
  try {
    await page.waitForURL((url) => url.href.startsWith(APP_URL), { timeout: 90000 });
  } catch (err) {
    await shot(page, `${label}-stripe-stuck`);
    const stripeMsg = await page.locator('body').innerText().catch(() => '');
    throw new Error(`Stripe did not redirect back. Page text: ${stripeMsg.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  await page.waitForLoadState('networkidle').catch(() => {});
}

// ============ JOURNEY A: static-route smoke ============
async function journeyStaticSmoke(browser) {
  const routes = [
    { path: '/', name: 'home', expect: /PassportSnap|passport/i },
    { path: '/about', name: 'about', expect: /About/i },
    { path: '/privacy', name: 'privacy', expect: /Privacy/i },
    { path: '/terms', name: 'terms', expect: /Terms/i },
    { path: '/cart', name: 'cart', expect: /cart/i },
    { path: '/dashboard', name: 'dashboard-loggedout', expect: /sign in|account|dashboard|orders/i },
    { path: '/document', name: 'document', expect: /document|passport|country|select/i },
  ];
  for (const route of routes) {
    const bucket = newDiagBucket();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    attachDiagnostics(page, bucket);
    try {
      await page.goto(`${APP_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(1200);
      const body = await page.locator('body').innerText();
      await shot(page, `A-${route.name}`);
      const matched = route.expect.test(body);
      const status = bucket.pageErrors.length ? 'fail' : matched ? 'pass' : 'warn';
      record(`A. static:${route.name}`, status, {
        note: `${route.path} | bodyLen=${body.length} | matched=${matched}`,
        pageErrors: bucket.pageErrors, consoleErrors: bucket.consoleErrors.slice(0, 5), apiErrors: bucket.apiErrors,
      });
    } catch (err) {
      await shot(page, `A-${route.name}-error`);
      record(`A. static:${route.name}`, 'fail', { note: String(err).slice(0, 200), pageErrors: bucket.pageErrors });
    } finally {
      await ctx.close();
    }
  }
}

// ============ JOURNEY B/C: guest purchase via seeded cart ============
async function journeyPurchase(browser, label, options, { prints = false } = {}) {
  const bucket = newDiagBucket();
  const ctx = await browser.newContext();
  await seedCart(ctx, DIGITAL_ITEM, options);
  const page = await ctx.newPage();
  attachDiagnostics(page, bucket);
  const verifyResponses = [];
  page.on('response', async (res) => {
    if (res.url().includes('/api/stripe/verify')) {
      let b = ''; try { b = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      verifyResponses.push(`${res.status()} ${b}`);
    }
  });

  try {
    await page.goto(`${APP_URL}/checkout`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.getByText('Choose your package').first().waitFor({ timeout: 30000 });
    await shot(page, `${label}-step1`);

    if (prints) {
      await page.getByRole('button', { name: /Digital Photo \+ Printouts/i }).first().click();
      await page.waitForTimeout(500);
    }
    // Step 1 -> 2
    await page.getByRole('button', { name: /^Continue$/ }).first().click();
    await page.getByText('Upgrade your order').first().waitFor({ timeout: 15000 });
    await shot(page, `${label}-step2`);
    // Step 2 -> 3
    await page.getByRole('button', { name: /^Continue$/ }).first().click();
    await page.getByText('Contact & Delivery').first().waitFor({ timeout: 15000 });

    await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
    if (prints) {
      await fillIfVisible(page, 'input[placeholder="Full name"]', 'E2E Tester');
      await fillIfVisible(page, 'input[placeholder="Street address"]', '20 W 34th St');
      const zip = page.locator('input[placeholder="ZIP code"]');
      if (await zip.count()) { await zip.first().fill('10001'); await zip.first().blur(); await page.waitForTimeout(600); }
    }
    await shot(page, `${label}-step3`);

    await page.getByRole('button', { name: /Pay now/i }).first().click();

    await payOnStripe(page, label);
    await page.waitForTimeout(9000); // allow verify + order build
    const body = await page.locator('body').innerText();
    await shot(page, `${label}-return`);

    const success = /Payment successful|Order confirmed|Thank you|Payment verified/i.test(body);
    const storage = await page.evaluate(() => ({
      orders: JSON.parse(window.localStorage.getItem('ps_orders') || '[]').length,
      pending: window.localStorage.getItem('ps_pending_payment'),
      cart: JSON.parse(window.localStorage.getItem('ps_cart') || '[]').length,
    }));
    const status = bucket.pageErrors.length ? 'fail' : success ? 'pass' : 'warn';
    record(`${label}`, status, {
      note: `success=${success} ordersStored=${storage.orders} cartCleared=${storage.cart === 0} finalUrl=${page.url().replace(APP_URL, '') || '/'}`,
      verifyResponses, apiErrors: bucket.apiErrors, pageErrors: bucket.pageErrors,
      consoleErrors: bucket.consoleErrors.slice(0, 5), bodyPreview: body.slice(0, 400),
    });
  } catch (err) {
    await shot(page, `${label}-error`);
    record(`${label}`, 'fail', { note: String(err).slice(0, 250), apiErrors: bucket.apiErrors, pageErrors: bucket.pageErrors, verifyResponses });
  } finally {
    await ctx.close();
  }
}

// ============ JOURNEY D: real photo pipeline ============
async function journeyPhotoPipeline(browser) {
  const bucket = newDiagBucket();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, bucket);
  const bgResponses = [];
  page.on('response', (res) => {
    if (res.url().includes('/api/remove-bg')) bgResponses.push(`${res.status()}`);
  });

  // Prioritised: phone selfies (portrait) first, then stock portraits.
  const candidates = [
    'WhatsApp Image 2026-04-07 at 11.06.38 PM.jpeg',
    'WhatsApp Image 2026-04-07 at 11.23.51 PM.jpeg',
    'WhatsApp Image 2026-04-08 at 12.14.41 PM (1).jpeg',
    'official-portrait-woman-passport-photo-600nw-2370794875.webp',
    'passport-photo-serious-young-adult-600nw-2317626543.webp',
  ];

  try {
    await page.goto(`${APP_URL}/capture`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);
    await shot(page, 'D-capture-initial');

    let accepted = null;
    for (const fixture of candidates) {
      const input = page.locator('input[type="file"][accept="image/*"]:not([capture])');
      await input.first().setInputFiles(resolve(FIXTURES, fixture)).catch(() => {});
      await page.waitForTimeout(2500);
      // Was it rejected for being landscape?
      const amber = await page.getByText(/vertical selfie|portrait photo/i).count();
      const hasUse = await page.getByRole('button', { name: /Use (This )?Photo/i }).count();
      if (!amber && hasUse) { accepted = fixture; break; }
    }

    if (!accepted) {
      await shot(page, 'D-no-portrait-accepted');
      record('D. photo-pipeline', 'warn', { note: 'No fixture accepted by portrait check (all landscape?)', consoleErrors: bucket.consoleErrors.slice(0, 5) });
      return;
    }
    await shot(page, 'D-draft-loaded');

    const reviewCta = page.getByRole('button', { name: /Use this photo|Checkout|Continue|Download|Add to cart|Looks good|Proceed|Get my|Retake/i });
    // Processing -> review. MediaPipe segmentation uses WebGL; under headless
    // software-GL it can stall, so retry the whole upload+process once.
    let reachedReview = false;
    for (let attempt = 1; attempt <= 2 && !reachedReview; attempt += 1) {
      await page.getByRole('button', { name: /Use (This )?Photo/i }).first().click();
      const deadline = Date.now() + 75000;
      while (Date.now() < deadline) {
        const path = new URL(page.url()).pathname;
        if (path === '/review' || path === '/result') { reachedReview = true; break; }
        if (await page.getByText(/could not|try another|not detect|failed/i).count()) break;
        await page.waitForTimeout(1500);
      }
      if (!reachedReview && attempt === 1) {
        await page.goto(`${APP_URL}/capture`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        const input = page.locator('input[type="file"][accept="image/*"]:not([capture])');
        await input.first().setInputFiles(resolve(FIXTURES, accepted)).catch(() => {});
        await page.waitForTimeout(2500);
      }
    }
    const landed = reachedReview && (await reviewCta.count()) > 0;
    await page.waitForTimeout(1000);
    await shot(page, 'D-after-processing');
    const body = await page.locator('body').innerText();
    const onReview = new URL(page.url()).pathname === '/review';
    const status = bucket.pageErrors.length ? 'fail' : (onReview || landed) ? 'pass' : 'warn';
    record('D. photo-pipeline', status, {
      note: `fixture="${accepted}" removeBg=[${bgResponses.join(',')}] url=${new URL(page.url()).pathname} reviewCta=${landed}`,
      apiErrors: bucket.apiErrors, pageErrors: bucket.pageErrors, consoleErrors: bucket.consoleErrors.slice(0, 6),
      bodyPreview: body.slice(0, 400),
    });
  } catch (err) {
    await shot(page, 'D-error');
    record('D. photo-pipeline', 'fail', { note: String(err).slice(0, 250), pageErrors: bucket.pageErrors, consoleErrors: bucket.consoleErrors.slice(0, 6) });
  } finally {
    await ctx.close();
  }
}

// ============ JOURNEY E: admin dashboard ============
async function journeyAdmin(browser) {
  const bucket = newDiagBucket();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, bucket);
  try {
    await page.goto(`${APP_URL}/admin`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1000);
    await shot(page, 'E-admin-login');

    await fillIfVisible(page, 'input[name="email"]', 'admin');
    await fillIfVisible(page, 'input[name="password"]', 'admin');
    await page.getByRole('button', { name: /Sign in to admin/i }).first().click();
    await page.waitForTimeout(4000);
    await shot(page, 'E-admin-overview');

    const body = await page.locator('body').innerText();
    const loggedIn = /Overview|Accounts|Queue|Settings|Revenue|Transactions/i.test(body) &&
      !/Sign in to admin/i.test(body);

    // Tab tour
    const tabs = ['Accounts', 'Queue', 'Settings', 'Overview'];
    const tabResults = {};
    for (const tab of tabs) {
      const btn = page.getByRole('button', { name: new RegExp(`^${tab}$`) });
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(1500);
        await shot(page, `E-admin-${tab.toLowerCase()}`);
        tabResults[tab] = true;
      } else {
        tabResults[tab] = false;
      }
    }

    const status = bucket.pageErrors.length ? 'fail' : loggedIn ? 'pass' : 'warn';
    record('E. admin-dashboard', status, {
      note: `loggedIn=${loggedIn} tabs=${JSON.stringify(tabResults)}`,
      apiErrors: bucket.apiErrors, pageErrors: bucket.pageErrors, consoleErrors: bucket.consoleErrors.slice(0, 6),
    });
  } catch (err) {
    await shot(page, 'E-admin-error');
    record('E. admin-dashboard', 'fail', { note: String(err).slice(0, 250), pageErrors: bucket.pageErrors });
  } finally {
    await ctx.close();
  }
}

// ============ JOURNEY F: dashboard logged-out + auth dialog ============
async function journeyAuthDialog(browser) {
  const bucket = newDiagBucket();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, bucket);
  try {
    await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);
    await shot(page, 'F-dashboard-loggedout');
    // Try to open the auth dialog via a sign-in CTA.
    const cta = page.getByRole('button', { name: /sign in|create account|log ?in/i });
    let dialogOpened = false;
    if (await cta.count()) {
      await cta.first().click();
      await page.waitForTimeout(1000);
      dialogOpened = await page.locator('input[name="email"]').count() > 0 &&
        await page.locator('input[name="password"]').count() > 0;
      await shot(page, 'F-auth-dialog');
    }
    const status = bucket.pageErrors.length ? 'fail' : 'pass';
    record('F. dashboard-loggedout/auth', status, {
      note: `authDialogOpened=${dialogOpened}`,
      pageErrors: bucket.pageErrors, consoleErrors: bucket.consoleErrors.slice(0, 5),
    });
  } catch (err) {
    record('F. dashboard-loggedout/auth', 'fail', { note: String(err).slice(0, 200) });
  } finally {
    await ctx.close();
  }
}

// ============ JOURNEY G: logged-in dashboard (orders + profile save) ============
async function journeyDashboardLoggedIn(browser) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    record('G. dashboard-loggedin', 'warn', { note: 'E2E_EMAIL/E2E_PASSWORD not set; skipped' });
    return;
  }
  const bucket = newDiagBucket();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  attachDiagnostics(page, bucket);
  // Watch for the original failure signature anywhere in network/console.
  const columnErrorSeen = [];
  page.on('response', async (res) => {
    if (res.url().includes('supabase.co') && res.status() >= 400) {
      let b = ''; try { b = await res.text(); } catch { /* ignore */ }
      if (/does not exist|42703|photo_package/i.test(b)) columnErrorSeen.push(b.slice(0, 200));
    }
  });
  try {
    await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1200);
    // Open auth dialog and sign in.
    const cta = page.getByRole('button', { name: /sign in|create account|log ?in/i });
    if (await cta.count()) { await cta.first().click(); await page.waitForTimeout(800); }
    await page.locator('input[name="email"]').first().fill(email);
    await page.locator('input[name="password"]').first().fill(password);
    await shot(page, 'G-signin-filled');
    await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).first().click();

    // Wait for authenticated dashboard: profile "Save profile" button or orders content.
    await page.getByRole('button', { name: /Save profile/i }).first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(3500); // allow orders to load
    await shot(page, 'G-dashboard');

    const body = await page.locator('body').innerText();
    const authError = /email or password is incorrect|confirm your account/i.test(body);
    const ordersError = /column .*does not exist|photo_package|unable to load your orders/i.test(body);
    const ordersCount = await page.locator('table tbody tr').count().catch(() => 0);
    const hasOrdersUi = ordersCount > 0 || /no orders yet|order history/i.test(body);

    // Exercise the exact action that originally failed: Save profile.
    let profileSaved = false; let profileMsg = '';
    if (!authError) {
      const phone = page.locator('input[name="phone"]');
      if (await phone.count()) { await phone.first().fill('5551234567'); }
      await page.getByRole('button', { name: /Save profile/i }).first().click();
      try {
        await page.getByText(/Profile updated successfully|Unable to update/i).first().waitFor({ timeout: 15000 });
        profileMsg = (await page.getByText(/Profile updated successfully|Unable to update/i).first().innerText()).slice(0, 80);
        profileSaved = /updated successfully/i.test(profileMsg);
      } catch { profileMsg = '(no banner)'; }
      await shot(page, 'G-profile-saved');
    }

    const status = (authError || ordersError || columnErrorSeen.length || bucket.pageErrors.length)
      ? 'fail'
      : (profileSaved && hasOrdersUi) ? 'pass' : 'warn';
    record('G. dashboard-loggedin', status, {
      note: `authError=${authError} ordersRows=${ordersCount} ordersUi=${hasOrdersUi} profileSaved=${profileSaved} profileMsg="${profileMsg}" columnError=${columnErrorSeen.length > 0}`,
      apiErrors: bucket.apiErrors, pageErrors: bucket.pageErrors, consoleErrors: bucket.consoleErrors.slice(0, 6),
      columnErrorSeen,
    });
  } catch (err) {
    await shot(page, 'G-error');
    record('G. dashboard-loggedin', 'fail', { note: String(err).slice(0, 250), pageErrors: bucket.pageErrors, apiErrors: bucket.apiErrors });
  } finally {
    await ctx.close();
  }
}

function shouldRun(key) {
  return !ONLY.length || ONLY.includes(key);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--enable-features=Vulkan',
    ],
  });
  console.log(`Running E2E suite against ${APP_URL}`);
  try {
    if (shouldRun('A')) await journeyStaticSmoke(browser);
    if (shouldRun('F')) await journeyAuthDialog(browser);
    if (shouldRun('G')) await journeyDashboardLoggedIn(browser);
    if (shouldRun('E')) await journeyAdmin(browser);
    if (shouldRun('D')) await journeyPhotoPipeline(browser);
    if (shouldRun('B')) await journeyPurchase(browser, 'B. purchase:digital', { photoPackage: 'digital', printCopies: 2, complianceCheck: false, photoRetouching: false, premiumRetouch: false });
    if (shouldRun('C')) await journeyPurchase(browser, 'C. purchase:prints+addons', { photoPackage: 'digital_prints', printCopies: 4, complianceCheck: true, photoRetouching: false, premiumRetouch: false }, { prints: true });
  } finally {
    await browser.close();
  }

  const summary = {
    ranAt: new Date().toISOString(),
    appUrl: APP_URL,
    total: results.length,
    pass: results.filter((r) => r.status === 'pass').length,
    warn: results.filter((r) => r.status === 'warn').length,
    fail: results.filter((r) => r.status === 'fail').length,
    results,
  };
  writeFileSync(resolve(OUT_DIR, 'report.json'), JSON.stringify(summary, null, 2));
  console.log('\n===== SUMMARY =====');
  console.log(`PASS ${summary.pass}  WARN ${summary.warn}  FAIL ${summary.fail}  (of ${summary.total})`);
  console.log(`Report: ${resolve(OUT_DIR, 'report.json')}`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
