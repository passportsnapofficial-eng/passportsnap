import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFile } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { DOCUMENT_TYPES, getDocumentById } from '../../data/documentTypes.js';
import { fromMinorUnits } from '../checkout/pricing.js';
import { normalizeSiteSettings } from '../settings/siteSettings.js';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const LOCAL_REVIEW_STORE_PATH = resolve(process.cwd(), 'server', 'admin-review-requests.json');
const SERVERLESS_REVIEW_STORE_PATH = resolve('/tmp', 'passportsnap-admin-review-requests.json');
const LOCAL_SETTINGS_STORE_PATH = resolve(process.cwd(), 'server', 'admin-site-settings.json');
const SERVERLESS_SETTINGS_STORE_PATH = resolve('/tmp', 'passportsnap-admin-site-settings.json');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin').trim();
const DOCUMENT_NAME_MAP = new Map(DOCUMENT_TYPES.map((document) => [document.id, document.name]));

function getReviewStorePath() {
  const configuredPath = String(process.env.ADMIN_REVIEW_STORE_PATH || '').trim();
  if (configuredPath) {
    return configuredPath;
  }

  return process.env.VERCEL ? SERVERLESS_REVIEW_STORE_PATH : LOCAL_REVIEW_STORE_PATH;
}

function getSettingsStorePath() {
  const configuredPath = String(process.env.ADMIN_SETTINGS_STORE_PATH || '').trim();
  if (configuredPath) {
    return configuredPath;
  }

  return process.env.VERCEL ? SERVERLESS_SETTINGS_STORE_PATH : LOCAL_SETTINGS_STORE_PATH;
}

function readJsonStore(filePath, fallbackValue) {
  if (!existsSync(filePath)) {
    return fallbackValue;
  }

  try {
    const contents = readFileSync(filePath, 'utf8');
    return JSON.parse(contents);
  } catch {
    return fallbackValue;
  }
}

function writeJsonStore(filePath, payload) {
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getStripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';

  if (!secretKey) {
    throw new Error('Transaction monitoring is unavailable right now.');
  }

  return secretKey;
}

function getSupabaseProjectUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
}

function getSupabaseServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    ''
  ).trim();
}

function hasSupabaseAdminAccess() {
  return Boolean(getSupabaseProjectUrl() && getSupabaseServiceRoleKey());
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }

  return false;
}

function normalizeDate(value) {
  if (!value) return null;

  if (typeof value === 'number') {
    const nextDate = new Date(value * 1000);
    return Number.isNaN(nextDate.getTime()) ? null : nextDate.toISOString();
  }

  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate.toISOString();
}

function normalizeDocumentIds(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function resolveDocumentLabel(documentIds) {
  if (!documentIds.length) {
    return 'No document captured';
  }

  const labels = documentIds.map((documentId) => DOCUMENT_NAME_MAP.get(documentId) || getDocumentById(documentId)?.name || documentId);
  return labels.join(', ');
}

function normalizeCustomerName({ name = '', email = '' } = {}) {
  return String(name || '').trim() || String(email || '').trim() || 'Customer';
}

function normalizeTransactionStatus(paymentStatus, sessionStatus) {
  const normalizedPaymentStatus = String(paymentStatus || '').trim().toLowerCase();
  const normalizedSessionStatus = String(sessionStatus || '').trim().toLowerCase();

  if (normalizedPaymentStatus === 'paid' || normalizedPaymentStatus === 'no_payment_required') {
    return 'success';
  }

  if (normalizedSessionStatus === 'expired') {
    return 'abandoned';
  }

  if (normalizedSessionStatus === 'open') {
    return 'pending';
  }

  return normalizedPaymentStatus || normalizedSessionStatus || 'unknown';
}

function normalizeReviewStatus(status) {
  const normalized = String(status || 'requested').trim().toLowerCase();
  if (['requested', 'queued', 'in_progress', 'completed', 'cancelled'].includes(normalized)) {
    return normalized;
  }

  return 'requested';
}

function normalizeRequestType(type) {
  return type === 'premium_retouch' ? 'premium_retouch' : 'manual_review';
}

function normalizePriority(priority) {
  const normalized = String(priority || 'normal').trim().toLowerCase();
  if (['low', 'normal', 'high', 'urgent'].includes(normalized)) {
    return normalized;
  }

  return 'normal';
}

function normalizeText(value, fallback = '') {
  return String(value || fallback).trim();
}

function normalizeReviewRequestRecord(item) {
  return {
    id: normalizeText(item.id),
    targetId: normalizeText(item.targetId || item.target_id),
    userKey: normalizeText(item.userKey || item.user_key),
    userEmail: normalizeText(item.userEmail || item.user_email).toLowerCase(),
    customerName: normalizeText(item.customerName || item.customer_name, 'Customer') || 'Customer',
    documentLabel: normalizeText(item.documentLabel || item.document_label, 'Passport photo') || 'Passport photo',
    transactionReference: normalizeText(item.transactionReference || item.transaction_reference || item.targetId || item.target_id),
    requestType: normalizeRequestType(item.requestType || item.request_type),
    status: normalizeReviewStatus(item.status),
    priority: normalizePriority(item.priority),
    assignee: normalizeText(item.assignee),
    note: normalizeText(item.note),
    fulfillmentNote: normalizeText(item.fulfillmentNote || item.fulfillment_note),
    createdAt: normalizeDate(item.createdAt || item.created_at),
    updatedAt: normalizeDate(item.updatedAt || item.updated_at),
    completedAt: normalizeDate(item.completedAt || item.completed_at),
  };
}

function buildSupabaseHeaders(extraHeaders = {}) {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

async function fetchJson(url, options, fallbackMessage) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || fallbackMessage);
  }

  return payload;
}

async function fetchSupabaseJson(path, options = {}, fallbackMessage = 'Unable to load data.') {
  const projectUrl = getSupabaseProjectUrl();
  if (!projectUrl || !getSupabaseServiceRoleKey()) {
    throw new Error('Supabase admin access is not configured.');
  }

  return fetchJson(
    `${projectUrl}/rest/v1/${path}`,
    {
      ...options,
      headers: buildSupabaseHeaders(options.headers),
    },
    fallbackMessage,
  );
}

function readLocalReviewRequests() {
  const candidatePaths = [getReviewStorePath()];

  if (!candidatePaths.includes(LOCAL_REVIEW_STORE_PATH)) {
    candidatePaths.push(LOCAL_REVIEW_STORE_PATH);
  }

  for (const filePath of candidatePaths) {
    const parsed = readJsonStore(filePath, null);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeReviewRequestRecord).sort((left, right) => sortByLatest(left.updatedAt, right.updatedAt));
    }
  }

  return [];
}

function writeLocalReviewRequests(reviews) {
  writeJsonStore(getReviewStorePath(), reviews);
}

function readLocalSiteSettings() {
  const candidatePaths = [getSettingsStorePath()];

  if (!candidatePaths.includes(LOCAL_SETTINGS_STORE_PATH)) {
    candidatePaths.push(LOCAL_SETTINGS_STORE_PATH);
  }

  for (const filePath of candidatePaths) {
    const parsed = readJsonStore(filePath, null);
    if (parsed && typeof parsed === 'object') {
      return normalizeSiteSettings(parsed);
    }
  }

  return normalizeSiteSettings({});
}

function writeLocalSiteSettings(settings) {
  writeJsonStore(getSettingsStorePath(), settings);
}

async function listTransactions() {
  const secretKey = getStripeSecretKey();
  const payload = await fetchJson(
    `${STRIPE_API_BASE}/checkout/sessions?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    },
    'Unable to load transaction data.',
  );

  const transactions = Array.isArray(payload?.data) ? payload.data : [];

  return transactions.map((transaction) => {
    const metadata = transaction.metadata || {};
    const documentIds = normalizeDocumentIds(metadata.documentIds || metadata.document_ids);
    const premiumRetouch = parseBoolean(metadata.premiumRetouch || metadata.premium_retouch);
    const customerEmail = String(
      transaction.customer_details?.email || transaction.customer_email || metadata.email || '',
    )
      .trim()
      .toLowerCase();
    const customerName = normalizeCustomerName({
      name: transaction.customer_details?.name || metadata.customerName || metadata.customer_name,
      email: customerEmail,
    });
    const customerPhone = String(
      transaction.customer_details?.phone || metadata.phone || '',
    ).trim();
    const reference = String(
      transaction.client_reference_id || metadata.orderReference || metadata.order_reference || transaction.id || '',
    ).trim();

    return {
      id: String(transaction.id || reference),
      reference,
      status: normalizeTransactionStatus(transaction.payment_status, transaction.status),
      amountMinor: Number(transaction.amount_total || 0),
      amount: fromMinorUnits(transaction.amount_total),
      currency: String(transaction.currency || 'USD').toUpperCase(),
      createdAt: normalizeDate(transaction.created),
      paidAt: normalizeDate(transaction.created),
      channel:
        Array.isArray(transaction.payment_method_types) && transaction.payment_method_types.length
          ? transaction.payment_method_types.join(', ')
          : 'card',
      gatewayResponse:
        transaction.payment_status === 'paid'
          ? 'Paid via Stripe Checkout'
          : `Stripe Checkout ${transaction.payment_status || transaction.status || 'updated'}`,
      customerEmail,
      customerName,
      customerPhone,
      customerCode: String(transaction.customer || '').trim(),
      documentIds,
      documentLabel: resolveDocumentLabel(documentIds),
      itemCount: Number(metadata.itemCount || metadata.item_count || documentIds.length || 1),
      premiumRetouch,
      rawStatus: String(transaction.payment_status || transaction.status || ''),
    };
  });
}

async function listProfiles() {
  if (!hasSupabaseAdminAccess()) {
    return [];
  }

  const payload = await fetchSupabaseJson(
    'profiles?select=id,email,full_name,phone,role,created_at,updated_at&order=created_at.desc',
    {},
    'Unable to load account profiles.',
  );

  return Array.isArray(payload) ? payload : [];
}

async function listOrders() {
  if (!hasSupabaseAdminAccess()) {
    return [];
  }

  const payload = await fetchSupabaseJson(
    'orders?select=id,user_id,order_date,status,subtotal,premium_retouch,premium_fee,total,payment_currency,payment_channel,payment_gateway_response,payment_reference,payment_verified_at,service_summary,items,created_at,updated_at&order=order_date.desc',
    {},
    'Unable to load order history.',
  );

  return Array.isArray(payload) ? payload : [];
}

async function listSupabaseReviewRequests() {
  const payload = await fetchSupabaseJson(
    'admin_review_requests?select=id,target_id,user_key,user_email,customer_name,document_label,transaction_reference,request_type,status,priority,assignee,note,fulfillment_note,created_at,updated_at,completed_at&order=updated_at.desc',
    {},
    'Unable to load review queue.',
  );

  return Array.isArray(payload) ? payload.map(normalizeReviewRequestRecord) : [];
}

async function readSupabaseSiteSettings() {
  const [siteRows, documentRows] = await Promise.all([
    fetchSupabaseJson(
      'admin_site_settings?select=id,premium_retouch_fee,watermark_text,watermark_enabled,updated_at&id=eq.default&limit=1',
      {},
      'Unable to load site settings.',
    ),
    fetchSupabaseJson(
      'admin_document_settings?select=document_id,price,is_active,display_order,updated_at&order=display_order.asc',
      {},
      'Unable to load document settings.',
    ),
  ]);

  const siteRecord = Array.isArray(siteRows) ? siteRows[0] || {} : siteRows || {};
  const documents = Array.isArray(documentRows) ? documentRows : [];

  return normalizeSiteSettings({
    premium_retouch_fee: siteRecord.premium_retouch_fee,
    watermark_text: siteRecord.watermark_text,
    watermark_enabled: siteRecord.watermark_enabled,
    updated_at: siteRecord.updated_at,
    documents,
  });
}

async function upsertSupabaseReviewRequest(reviewRequest) {
  const payload = {
    id: reviewRequest.id,
    target_id: reviewRequest.targetId,
    user_key: reviewRequest.userKey || null,
    user_email: reviewRequest.userEmail || null,
    customer_name: reviewRequest.customerName,
    document_label: reviewRequest.documentLabel,
    transaction_reference: reviewRequest.transactionReference,
    request_type: reviewRequest.requestType,
    status: reviewRequest.status,
    priority: reviewRequest.priority,
    assignee: reviewRequest.assignee || null,
    note: reviewRequest.note || null,
    fulfillment_note: reviewRequest.fulfillmentNote || null,
    completed_at: reviewRequest.completedAt || null,
  };

  const rows = await fetchSupabaseJson(
    'admin_review_requests?on_conflict=id',
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify([payload]),
    },
    'Unable to update the review queue.',
  );

  return normalizeReviewRequestRecord(Array.isArray(rows) ? rows[0] || payload : rows || payload);
}

async function upsertSupabaseSiteSettings(settings) {
  await Promise.all([
    fetchSupabaseJson(
      'admin_site_settings?on_conflict=id',
      {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify([
          {
            id: 'default',
            premium_retouch_fee: settings.premiumRetouchFee,
            watermark_text: settings.watermarkText,
            watermark_enabled: settings.watermarkEnabled,
          },
        ]),
      },
      'Unable to save site settings.',
    ),
    fetchSupabaseJson(
      'admin_document_settings?on_conflict=document_id',
      {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(
          settings.documents.map((document) => ({
            document_id: document.documentId,
            price: document.price,
            is_active: document.isActive,
            display_order: document.displayOrder,
          })),
        ),
      },
      'Unable to save document pricing.',
    ),
  ]);

  return readSupabaseSiteSettings();
}

function createUserRecord({
  key,
  id = '',
  email = '',
  name = '',
  phone = '',
  role = 'customer',
  createdAt = null,
  source = 'transaction',
}) {
  return {
    key,
    id,
    email,
    name: name || email || 'Customer',
    phone,
    role,
    createdAt,
    source,
    orderCount: 0,
    transactionCount: 0,
    successfulTransactions: 0,
    pendingTransactions: 0,
    abandonedTransactions: 0,
    totalSpent: 0,
    premiumOrders: 0,
    latestActivityAt: createdAt,
    orders: [],
    transactions: [],
    reviewRequests: [],
  };
}

function sortByLatest(a, b) {
  const aValue = a ? new Date(a).getTime() : 0;
  const bValue = b ? new Date(b).getTime() : 0;
  return bValue - aValue;
}

function touchLatest(currentValue, nextValue) {
  if (!nextValue) return currentValue;
  if (!currentValue) return nextValue;
  return new Date(currentValue).getTime() >= new Date(nextValue).getTime() ? currentValue : nextValue;
}

function buildFallbackUserKeyFromEmail(email) {
  return email ? `email:${email.toLowerCase()}` : `customer:${Math.random().toString(36).slice(2, 10)}`;
}

function ensureUserRecord(indexes, payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const key = payload.key || payload.id || (email ? `email:${email}` : buildFallbackUserKeyFromEmail(email));
  const existing =
    indexes.byKey.get(key) ||
    (payload.id ? indexes.byId.get(payload.id) : null) ||
    (email ? indexes.byEmail.get(email) : null);

  if (existing) {
    existing.id = existing.id || payload.id || '';
    existing.email = existing.email || email;
    existing.name = payload.name || existing.name;
    existing.phone = payload.phone || existing.phone;
    existing.role = payload.role || existing.role;
    existing.createdAt = existing.createdAt || payload.createdAt || null;
    existing.source = existing.source === 'profile' ? 'profile' : payload.source || existing.source;
    if (payload.id) {
      indexes.byId.set(payload.id, existing);
    }
    if (email) {
      indexes.byEmail.set(email, existing);
    }
    indexes.byKey.set(existing.key, existing);
    return existing;
  }

  const nextRecord = createUserRecord({
    key,
    id: payload.id,
    email,
    name: payload.name,
    phone: payload.phone,
    role: payload.role,
    createdAt: payload.createdAt,
    source: payload.source,
  });

  indexes.byKey.set(nextRecord.key, nextRecord);
  if (nextRecord.id) {
    indexes.byId.set(nextRecord.id, nextRecord);
  }
  if (email) {
    indexes.byEmail.set(email, nextRecord);
  }

  return nextRecord;
}

function normalizeOrderRecord(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const documentIds = items.map((item) => String(item?.documentId || '').trim()).filter(Boolean);

  return {
    id: String(order.id || ''),
    userId: String(order.user_id || ''),
    date: normalizeDate(order.order_date || order.created_at),
    status: String(order.status || 'paid'),
    subtotal: Number(order.subtotal || 0),
    premiumRetouch: parseBoolean(order.premium_retouch),
    premiumFee: Number(order.premium_fee || 0),
    total: Number(order.total || 0),
    paymentCurrency: String(order.payment_currency || 'USD'),
    paymentChannel: String(order.payment_channel || 'online'),
    paymentGatewayResponse: String(order.payment_gateway_response || 'Processed'),
    paymentReference: String(order.payment_reference || ''),
    paymentVerifiedAt: normalizeDate(order.payment_verified_at),
    serviceSummary: String(order.service_summary || resolveDocumentLabel(documentIds)),
    documentLabel: resolveDocumentLabel(documentIds),
    items,
  };
}

async function loadReviewRequests() {
  if (hasSupabaseAdminAccess()) {
    try {
      return await listSupabaseReviewRequests();
    } catch {
      return readLocalReviewRequests();
    }
  }

  return readLocalReviewRequests();
}

async function loadSiteSettings() {
  if (hasSupabaseAdminAccess()) {
    try {
      return await readSupabaseSiteSettings();
    } catch {
      return readLocalSiteSettings();
    }
  }

  return readLocalSiteSettings();
}

function buildAdminToken() {
  return Buffer.from(`${ADMIN_EMAIL}:${ADMIN_PASSWORD}`).toString('base64url');
}

function safeStringEquals(a, b) {
  try {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
      // Still run a comparison against itself to avoid timing differences.
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function authenticateAdmin(email, password) {
  const normalizedEmail = String(email || '').trim();
  const normalizedPassword = String(password || '').trim();

  const emailMatch = safeStringEquals(normalizedEmail, ADMIN_EMAIL);
  const passwordMatch = safeStringEquals(normalizedPassword, ADMIN_PASSWORD);

  if (!emailMatch || !passwordMatch) {
    throw new Error('Invalid admin credentials.');
  }

  return {
    email: ADMIN_EMAIL,
    token: buildAdminToken(),
  };
}

export function isValidAdminToken(token) {
  if (!token) return false;
  return safeStringEquals(String(token).trim(), buildAdminToken());
}

export async function listAdminReviewRequests() {
  return loadReviewRequests();
}

export async function upsertAdminReviewRequest(payload) {
  const requestType = normalizeRequestType(payload.requestType || payload.request_type);
  const status = normalizeReviewStatus(payload.status || 'requested');
  const priority = normalizePriority(payload.priority || 'normal');
  const now = new Date().toISOString();
  const targetId = normalizeText(payload.targetId || payload.target_id || payload.transactionReference || payload.transaction_reference);

  if (!targetId) {
    throw new Error('A transaction or order reference is required.');
  }

  const requestId = normalizeText(payload.id || `${requestType}:${targetId}`);
  const nextItem = normalizeReviewRequestRecord({
    id: requestId,
    targetId,
    userKey: payload.userKey || payload.user_key,
    userEmail: payload.userEmail || payload.user_email,
    customerName: payload.customerName || payload.customer_name || 'Customer',
    documentLabel: payload.documentLabel || payload.document_label || 'Passport photo',
    transactionReference: payload.transactionReference || payload.transaction_reference || targetId,
    requestType,
    status,
    priority,
    assignee: payload.assignee,
    note: payload.note,
    fulfillmentNote: payload.fulfillmentNote || payload.fulfillment_note,
    completedAt:
      status === 'completed'
        ? normalizeDate(payload.completedAt || payload.completed_at) || now
        : null,
  });

  if (hasSupabaseAdminAccess()) {
    try {
      return await upsertSupabaseReviewRequest(nextItem);
    } catch {
      // Fall through to the local file store for local verification.
    }
  }

  const currentItems = readLocalReviewRequests();
  const existingItem = currentItems.find((item) => item.id === requestId);
  const localItem = {
    ...existingItem,
    ...nextItem,
    createdAt: existingItem?.createdAt || now,
    updatedAt: now,
    completedAt: nextItem.completedAt,
  };

  const nextItems = [localItem, ...currentItems.filter((item) => item.id !== requestId)];
  await writeLocalReviewRequests(nextItems);
  return localItem;
}

export async function getAdminSiteSettings() {
  return loadSiteSettings();
}

export async function saveAdminSiteSettings(payload) {
  const normalizedSettings = normalizeSiteSettings(payload);

  if (hasSupabaseAdminAccess()) {
    try {
      return await upsertSupabaseSiteSettings(normalizedSettings);
    } catch {
      // Fall back to the local file store when service-role access is not available locally.
    }
  }

  const nextSettings = normalizeSiteSettings({
    ...normalizedSettings,
    updatedAt: new Date().toISOString(),
  });
  await writeLocalSiteSettings(nextSettings);
  return nextSettings;
}

export async function getPublicSiteSettings() {
  return loadSiteSettings();
}

export async function getAdminOverview() {
  const [reviewRequests, transactions, profiles, orders, settings] = await Promise.all([
    loadReviewRequests(),
    listTransactions(),
    listProfiles().catch(() => []),
    listOrders().catch(() => []),
    loadSiteSettings(),
  ]);

  const indexes = {
    byKey: new Map(),
    byId: new Map(),
    byEmail: new Map(),
  };

  for (const profile of profiles) {
    ensureUserRecord(indexes, {
      key: profile.id,
      id: profile.id,
      email: profile.email,
      name: profile.full_name || profile.email,
      phone: profile.phone,
      role: profile.role || 'customer',
      createdAt: normalizeDate(profile.created_at),
      source: 'profile',
    });
  }

  const normalizedOrders = orders.map(normalizeOrderRecord);

  for (const order of normalizedOrders) {
    const userRecord = ensureUserRecord(indexes, {
      key: order.userId || undefined,
      id: order.userId || undefined,
      source: profiles.length ? 'profile' : 'transaction',
    });

    userRecord.orders.push(order);
    userRecord.orderCount += 1;
    userRecord.totalSpent += Number(order.total || 0);
    userRecord.premiumOrders += order.premiumRetouch ? 1 : 0;
    userRecord.latestActivityAt = touchLatest(
      userRecord.latestActivityAt,
      order.paymentVerifiedAt || order.date,
    );
  }

  for (const transaction of transactions) {
    const userRecord = ensureUserRecord(indexes, {
      email: transaction.customerEmail,
      name: transaction.customerName,
      phone: transaction.customerPhone,
      source: 'transaction',
    });

    userRecord.transactions.push(transaction);
    userRecord.transactionCount += 1;
    userRecord.latestActivityAt = touchLatest(
      userRecord.latestActivityAt,
      transaction.paidAt || transaction.createdAt,
    );

    if (transaction.status === 'success') {
      userRecord.successfulTransactions += 1;
      userRecord.totalSpent += normalizedOrders.length ? 0 : Number(transaction.amount || 0);
    } else if (['pending', 'ongoing', 'processing', 'queued'].includes(transaction.status)) {
      userRecord.pendingTransactions += 1;
    } else if (['abandoned', 'failed', 'reversed'].includes(transaction.status)) {
      userRecord.abandonedTransactions += 1;
    }
  }

  for (const request of reviewRequests) {
    const userRecord =
      indexes.byKey.get(request.userKey) ||
      indexes.byEmail.get(String(request.userEmail || '').toLowerCase()) ||
      null;

    if (userRecord) {
      userRecord.reviewRequests.push(request);
      userRecord.latestActivityAt = touchLatest(userRecord.latestActivityAt, request.updatedAt);
    }
  }

  const users = Array.from(indexes.byKey.values())
    .map((user) => ({
      ...user,
      totalSpent: Number(user.totalSpent.toFixed(2)),
      orders: user.orders.sort((left, right) => sortByLatest(left.paymentVerifiedAt || left.date, right.paymentVerifiedAt || right.date)),
      transactions: user.transactions.sort((left, right) => sortByLatest(left.paidAt || left.createdAt, right.paidAt || right.createdAt)),
      reviewRequests: user.reviewRequests.sort((left, right) => sortByLatest(left.updatedAt, right.updatedAt)),
    }))
    .sort((left, right) => sortByLatest(left.latestActivityAt, right.latestActivityAt));

  const paidTransactions = transactions.filter((transaction) => transaction.status === 'success');
  const pendingTransactions = transactions.filter((transaction) =>
    ['pending', 'ongoing', 'processing', 'queued'].includes(transaction.status),
  );
  const queuedReviews = reviewRequests.filter((item) => !['completed', 'cancelled'].includes(item.status));

  const metrics = {
    accountCount: users.length,
    orderCount: normalizedOrders.length || paidTransactions.length,
    transactionCount: transactions.length,
    revenue: Number(
      (
        normalizedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) ||
        paidTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
      ).toFixed(2),
    ),
    premiumQueueCount: reviewRequests.filter(
      (item) => item.requestType === 'premium_retouch' && item.status !== 'completed',
    ).length,
    manualQueueCount: reviewRequests.filter(
      (item) => item.requestType === 'manual_review' && item.status !== 'completed',
    ).length,
    pendingTransactionCount: pendingTransactions.length,
    paidTransactionCount: paidTransactions.length,
    activeDocumentCount: settings.documents.filter((document) => document.isActive).length,
    queuedReviewCount: queuedReviews.length,
    inProgressReviewCount: reviewRequests.filter((item) => item.status === 'in_progress').length,
  };

  return {
    mode: profiles.length || normalizedOrders.length ? 'full' : 'transaction_backed',
    refreshedAt: new Date().toISOString(),
    metrics,
    settings,
    users,
    transactions: transactions.sort((left, right) => sortByLatest(left.paidAt || left.createdAt, right.paidAt || right.createdAt)),
    reviewRequests,
  };
}
