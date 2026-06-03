/**
 * Verify the "payment verified but no items in the cart" fix.
 * Seeds the cart ONCE, then on the Stripe RETURN deletes ps_cart to force the
 * app to rely solely on the (now synchronously-persisted) pendingPayment cart
 * snapshot. Pre-fix this throws "payment verified, but no items"; post-fix it
 * completes to /success.
 */
import { chromium } from 'playwright';

const APP = (process.env.APP_URL || 'http://127.0.0.1:8790').replace(/\/$/, '');
const EMAIL = 'repro@example.com';
const STARVE_CART = process.env.STARVE_CART !== 'false'; // delete ps_cart on return

const ITEM = {
  id: 'repro-1', resultId: 'r1', documentId: 'us-passport', documentName: 'U.S. Passport',
  countryLabel: 'United States', sizeLabel: '2 x 2 in', outputLabel: 'Digital image',
  flagPath: '/flags/us.svg', backgroundLabel: 'White', basePrice: 12.95,
  photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AvwAH/9k=',
  // ~3MB original upload to simulate a real high-res photo and stress localStorage quota.
  sourcePhoto: 'data:image/jpeg;base64,' + 'A'.repeat(3_000_000),
  outputWidth: 1200, outputHeight: 1200, statusLabel: 'Ready',
  backgroundRemovalApplied: false, requiresPremiumRetouch: false, addedAt: '2026-06-03T00:00:00.000Z',
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const DISABLE_SYNC = process.env.DISABLE_SYNC === 'true'; // simulate pre-fix
await ctx.addInitScript(({ item, starve, disableSync }) => {
  if (disableSync) { window.__DISABLE_SYNC_PERSIST__ = true; }
  if (!window.sessionStorage.getItem('repro_seeded')) {
    window.localStorage.setItem('ps_cart', JSON.stringify([item]));
    window.localStorage.setItem('ps_cart_options', JSON.stringify({ photoPackage: 'digital', printCopies: 2, complianceCheck: false, photoRetouching: false, premiumRetouch: false }));
    window.localStorage.removeItem('ps_pending_payment');
    window.localStorage.removeItem('ps_orders');
    window.sessionStorage.setItem('repro_seeded', '1');
  } else if (starve && /stripe=success|session_id=/.test(window.location.search)) {
    // Simulate a real user whose cart did NOT survive the round-trip.
    window.localStorage.removeItem('ps_cart');
  }
}, { item: ITEM, starve: STARVE_CART, disableSync: DISABLE_SYNC });

const page = await ctx.newPage();
const verifyResp = [];
page.on('response', async (r) => { if (r.url().includes('/api/stripe/verify')) { let b=''; try{b=(await r.text()).slice(0,160);}catch{} verifyResp.push(`${r.status()}`); } });
async function fill(sel, val) { const l = page.locator(sel); if (await l.count()) { try { await l.first().fill(val, { timeout: 4000 }); return true; } catch {} } return false; }

await page.goto(`${APP}/checkout`, { waitUntil: 'networkidle' });
await page.getByText('Choose your package').first().waitFor({ timeout: 30000 });
await page.getByRole('button', { name: /^Continue$/ }).first().click();
await page.getByText('Upgrade your order').first().waitFor({ timeout: 15000 });
await page.getByRole('button', { name: /^Continue$/ }).first().click();
await page.getByText('Contact & Delivery').first().waitFor({ timeout: 15000 });
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.getByRole('button', { name: /Pay now/i }).first().click();

// --- Stripe hosted checkout (same robust path as the e2e suite) ---
await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 });
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(3500);
await fill('input[name="email"]', EMAIL);
let cardVisible = await page.locator('input[autocomplete="cc-number"]').isVisible().catch(() => false);
if (!cardVisible) {
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[aria-label="Pay with card"], button[data-testid="card-accordion-item-button"], #card-tab, [data-testid="card-tab"]'));
    const t = btns.find((b) => b instanceof HTMLElement && b.getBoundingClientRect().width > 0) || btns[0];
    if (t instanceof HTMLElement) t.click();
  });
  await page.waitForTimeout(1500);
}
await page.waitForSelector('input[autocomplete="cc-number"]', { timeout: 30000 });
await fill('input[autocomplete="cc-number"]', '4242424242424242');
await fill('input[autocomplete="cc-exp"]', '1234');
await fill('input[autocomplete="cc-csc"]', '123');
await fill('input[autocomplete="cc-name"]', 'Repro Tester');
for (const s of ['input[name="billingPostalCode"]','#billingPostalCode','input[autocomplete="postal-code"]']) { if (await fill(s,'10001')) break; }
await page.waitForTimeout(400);
const pay = page.getByRole('button', { name: /^Pay$|Pay \$|Pay US/i });
if (await pay.count()) await pay.last().click({ force: true }); else await page.locator('button[type="submit"]').last().click({ force: true });

await page.waitForURL((u) => u.href.startsWith(APP), { timeout: 90000 });
await page.waitForTimeout(10000);

const body = await page.locator('body').innerText();
const store = await page.evaluate(() => ({
  cart: JSON.parse(localStorage.getItem('ps_cart') || '[]').length,
  pendingPresent: Boolean(localStorage.getItem('ps_pending_payment')),
  orders: JSON.parse(localStorage.getItem('ps_orders') || '[]').length,
}));
console.log('STARVE_CART (delete ps_cart on return):', STARVE_CART);
console.log('verify responses:', JSON.stringify(verifyResp));
console.log('on return -> ps_cart:', store.cart, '| ps_orders:', store.orders, '| pending still present:', store.pendingPresent);
console.log('shows EMPTY-CART error:', /no cart items|there are no cart items|payment was verified, but/i.test(body));
console.log('shows success:', /Payment successful/i.test(body));
console.log('final url:', page.url().replace(APP, '') || '/');
console.log('RESULT:', (/Payment successful/i.test(body) && store.orders >= 1) ? 'PASS (order completed)' : 'FAIL');
await browser.close();
