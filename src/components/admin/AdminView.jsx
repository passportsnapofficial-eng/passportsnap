import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Download,
  Image as ImageIcon,
  ListChecks,
  LoaderCircle,
  LogOut,
  Mail,
  Phone,
  ReceiptText,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import {
  adminLogin,
  clearAdminSession,
  fetchAdminOverview,
  getStoredAdminSession,
  saveAdminReviewRequest,
  saveAdminSiteSettings,
} from '../../lib/admin/adminClient';
import { getDocumentById } from '../../data/documentTypes.js';
import { normalizeSiteSettings } from '../../lib/settings/siteSettings.js';
import { formatCurrency, formatDate, formatDownloadFilename } from '../../lib/utils/formatters';

// ─── Formatters ─────────────────────────────────────────────────────────────

function formatDateTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(date);
}

function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function titleize(value = '') {
  return String(value).split(/[_\s-]+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function getPrimaryOrderItem(order) {
  return Array.isArray(order?.items) ? order.items[0] || null : null;
}

function getOrderItemSourceImage(item) {
  return String(item?.sourcePhoto || item?.originalPhoto || item?.sourceImageUrl || '').trim();
}

function getOrderItemProcessedImage(item) {
  return String(item?.fulfilledPhoto || item?.processedImageUrl || item?.photo || '').trim();
}

function buildAdminDownloadFilename(item, ownerName, suffix = '') {
  const baseName = formatDownloadFilename(item, ownerName).replace(/\.jpg$/i, '');
  return `${baseName}${suffix ? `-${suffix}` : ''}.jpg`;
}

function formatAddress(address) {
  if (!address || typeof address !== 'object') return 'Not captured';
  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.stateProvince,
    address.postalCode,
    address.country,
  ].filter(Boolean).join(', ') || 'Not captured';
}

function describeOrderOptions(order) {
  const labels = [
    order.photoPackage === 'digitalPrints'
      ? `Print order${Number(order.printCopies || 0) ? ` · ${order.printCopies} copies` : ''}`
      : 'Digital order',
    order.complianceCheck ? 'Compliance check' : null,
    order.photoRetouching ? 'Photo retouching' : null,
    order.premiumRetouch ? 'Premium retouch' : null,
  ].filter(Boolean);

  return labels.join(' · ');
}

function downloadImageAsset(imageUrl, filename) {
  if (!imageUrl) return;
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}

function ImagePreviewCard({ title, imageUrl, alt, onDownload, emptyLabel = 'Not stored yet' }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </div>
        {imageUrl && onDownload ? (
          <button type="button" onClick={onDownload} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700">
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        ) : null}
      </div>
      {imageUrl ? (
        <img src={imageUrl} alt={alt} className="max-h-80 w-full rounded-xl object-contain bg-white" />
      ) : (
        <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function OrderItemImages({ item, ownerName, fallbackLabel }) {
  const originalImageUrl = getOrderItemSourceImage(item);
  const processedImageUrl = getOrderItemProcessedImage(item);
  const downloadItem = {
    ...item,
    countryLabel: item?.countryLabel || fallbackLabel,
  };

  if (!originalImageUrl && !processedImageUrl) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">{item?.documentName || fallbackLabel || 'Order image'}</div>
          <div className="text-xs text-slate-500">
            {[item?.sizeLabel, item?.backgroundLabel].filter(Boolean).join(' · ') || 'Saved image assets'}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {originalImageUrl ? (
            <button
              type="button"
              onClick={() => downloadImageAsset(originalImageUrl, buildAdminDownloadFilename(downloadItem, ownerName, 'original'))}
              className="secondary-button px-3 py-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Original
            </button>
          ) : null}
          {processedImageUrl ? (
            <button
              type="button"
              onClick={() => downloadImageAsset(processedImageUrl, buildAdminDownloadFilename(downloadItem, ownerName, 'processed'))}
              className="secondary-button px-3 py-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Processed
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ImagePreviewCard
          title="Original / unprocessed"
          imageUrl={originalImageUrl}
          alt={item?.documentName || 'Original upload'}
          onDownload={originalImageUrl
            ? () => downloadImageAsset(originalImageUrl, buildAdminDownloadFilename(downloadItem, ownerName, 'original'))
            : null}
        />
        <ImagePreviewCard
          title={item?.fulfilledPhoto ? 'Fulfilled image' : 'Processed image'}
          imageUrl={processedImageUrl}
          alt={item?.documentName || 'Processed image'}
          onDownload={processedImageUrl
            ? () => downloadImageAsset(processedImageUrl, buildAdminDownloadFilename(downloadItem, ownerName, 'processed'))
            : null}
        />
      </div>
    </div>
  );
}

function buildUserImageRows(selectedUser, selectedOrders = []) {
  const rows = [];
  const ownerName = selectedUser?.name || selectedUser?.email || 'customer';

  selectedOrders.forEach((order) => {
    const items = Array.isArray(order.items) && order.items.length ? order.items : [order];
    items.forEach((item, index) => {
      const sourceImageUrl = getOrderItemSourceImage(item) || String(order.sourceImageUrl || '').trim();
      const processedImageUrl = getOrderItemProcessedImage(item) || String(order.processedImageUrl || '').trim();
      const fulfilledImageUrl = String(item?.fulfilledPhoto || order.fulfilledImageUrl || '').trim();

      if (!sourceImageUrl && !processedImageUrl && !fulfilledImageUrl) {
        return;
      }

      rows.push({
        id: item.id || item.resultId || `${order.id}-${index}`,
        source: 'order',
        label: item.documentName || order.documentLabel || order.serviceSummary || 'Passport photo',
        reference: order.paymentReference || order.id,
        date: order.paymentVerifiedAt || order.date,
        status: fulfilledImageUrl ? 'fulfilled' : processedImageUrl ? 'processed' : 'unprocessed',
        ownerName,
        item: {
          ...item,
          countryLabel: item.countryLabel || order.documentLabel || 'Passport photo',
          documentName: item.documentName || order.documentLabel || order.serviceSummary || 'Passport photo',
        },
        sourceImageUrl,
        processedImageUrl: fulfilledImageUrl || processedImageUrl,
      });
    });
  });

  (selectedUser?.reviewRequests || []).forEach((request) => {
    if (!request.sourceImageUrl && !request.processedImageUrl && !request.fulfilledImageUrl) {
      return;
    }

    rows.push({
      id: request.id,
      source: 'queue',
      label: request.documentLabel || 'Passport photo',
      reference: request.transactionReference || request.targetId,
      date: request.updatedAt || request.createdAt,
      status: request.status || 'requested',
      ownerName,
      item: {
        ...request,
        documentName: request.documentLabel || 'Passport photo',
        countryLabel: request.documentLabel || 'Passport photo',
      },
      sourceImageUrl: request.sourceImageUrl,
      processedImageUrl: request.fulfilledImageUrl || request.processedImageUrl,
    });
  });

  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.reference}:${row.label}:${row.sourceImageUrl}:${row.processedImageUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function CustomerImageDashboard({ selectedUser, selectedOrders }) {
  const imageRows = buildUserImageRows(selectedUser, selectedOrders);
  const processedCount = imageRows.filter((row) => row.processedImageUrl).length;
  const unprocessedCount = imageRows.filter((row) => row.sourceImageUrl).length;

  return (
    <div className="space-y-4">
      <CardShell className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              Customer image dashboard
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Preview every source image and final processed image saved for this user.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[18rem]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-lg font-bold text-slate-950">{imageRows.length}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sets</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-lg font-bold text-slate-950">{unprocessedCount}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Originals</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-lg font-bold text-slate-950">{processedCount}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Finals</div>
            </div>
          </div>
        </div>
      </CardShell>

      {imageRows.length ? (
        <div className="grid gap-4 2xl:grid-cols-2">
          {imageRows.map((row) => (
            <CardShell key={row.id} className="overflow-hidden p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-950">{row.label}</div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    {row.reference || 'No reference'} · {formatDateTime(row.date)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone={row.source === 'order' ? 'emerald' : 'blue'}>{titleize(row.source)}</Pill>
                  <Pill tone={row.status === 'fulfilled' || row.status === 'processed' || row.status === 'completed' ? 'emerald' : 'amber'}>
                    {titleize(row.status)}
                  </Pill>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ImagePreviewCard
                  title="Original / unprocessed"
                  imageUrl={row.sourceImageUrl}
                  alt={`${row.label} original`}
                  onDownload={row.sourceImageUrl
                    ? () => downloadImageAsset(row.sourceImageUrl, buildAdminDownloadFilename(row.item, row.ownerName, 'original'))
                    : null}
                />
                <ImagePreviewCard
                  title="Final / processed"
                  imageUrl={row.processedImageUrl}
                  alt={`${row.label} processed`}
                  onDownload={row.processedImageUrl
                    ? () => downloadImageAsset(row.processedImageUrl, buildAdminDownloadFilename(row.item, row.ownerName, 'processed'))
                    : null}
                />
              </div>
            </CardShell>
          ))}
        </div>
      ) : (
        <EmptyState icon={ImageIcon} title="No stored images for this customer" body="Original and processed previews appear here after an order saves image assets." />
      )}
    </div>
  );
}

// ─── Shared UI atoms ─────────────────────────────────────────────────────────

function Pill({ children, tone = 'slate' }) {
  const tones = {
    slate:   'border-slate-200   bg-slate-50    text-slate-700',
    blue:    'border-blue-200    bg-blue-50     text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50  text-emerald-700',
    amber:   'border-amber-200   bg-amber-50    text-amber-700',
    red:     'border-red-200     bg-red-50      text-red-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function StatusBanner({ state }) {
  if (!state?.message) return null;
  const isError = state.status === 'error';
  return (
    <div className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${
      isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    }`}>
      {isError ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      {state.message}
    </div>
  );
}

function CardShell({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] ${className}`}>
      {children}
    </div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function EmptyState({ icon: Icon = Search, title, body }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {body ? <p className="mt-1 text-sm text-slate-500">{body}</p> : null}
      </div>
    </div>
  );
}

// ─── Login Gate ──────────────────────────────────────────────────────────────

function LoginGate({ loading, errorMessage, onSubmit }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(219,234,254,0.6),_rgba(248,250,252,0.98)_60%)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1d4ed8,#2563eb)] shadow-[0_12px_32px_-8px_rgba(37,99,235,0.55)]">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="mt-1.5 text-sm text-slate-500">PassportSnap operations center</p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] sm:p-8">
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <div className="mb-1.5 text-sm font-semibold text-slate-700">Email</div>
              <input type="text" name="email" defaultValue="admin" className="input-shell" required autoComplete="username" />
            </label>
            <label className="block">
              <div className="mb-1.5 text-sm font-semibold text-slate-700">Password</div>
              <input type="password" name="password" defaultValue="admin" className="input-shell" required autoComplete="current-password" />
            </label>
            {errorMessage ? (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {errorMessage}
              </div>
            ) : null}
            <button type="submit" disabled={loading} className="primary-button w-full justify-center">
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Sign in to admin
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, tone = 'blue' }) {
  const tones = {
    blue:    { icon: 'bg-blue-50 text-blue-600',       bar: 'bg-blue-500' },
    emerald: { icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
    amber:   { icon: 'bg-amber-50 text-amber-600',     bar: 'bg-amber-400' },
    violet:  { icon: 'bg-violet-50 text-violet-600',   bar: 'bg-violet-500' },
    slate:   { icon: 'bg-slate-100 text-slate-600',    bar: 'bg-slate-400' },
  };
  const t = tones[tone] || tones.blue;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${t.bar}`} />
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</div>
          {sub ? <div className="mt-1.5 truncate text-xs text-slate-500">{sub}</div> : null}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${t.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Detail mini-card ────────────────────────────────────────────────────────

function MiniDetail({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">{label}</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ metrics, overview, loading, onRefresh }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Overview</h2>
          <p className="text-sm text-slate-500">Live snapshot of your PassportSnap operations.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading}
          className="secondary-button gap-2 px-4 py-2 text-sm">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard icon={<Users className="h-5 w-5" />} label="Accounts" value={metrics.accountCount} sub="Unique customer records" tone="blue" />
        <MetricCard icon={<ReceiptText className="h-5 w-5" />} label="Transactions" value={metrics.transactionCount} sub={`${metrics.paidTransactionCount} paid · ${metrics.pendingTransactionCount} pending`} tone="emerald" />
        <MetricCard icon={<Wallet className="h-5 w-5" />} label="Revenue" value={formatCurrency(metrics.revenue)} sub="Completed order value" tone="violet" />
        <MetricCard icon={<Sparkles className="h-5 w-5" />} label="Open queue" value={metrics.queuedReviewCount} sub={`${metrics.inProgressReviewCount ?? 0} in progress`} tone="amber" />
        <MetricCard icon={<Settings2 className="h-5 w-5" />} label="Live formats" value={metrics.activeDocumentCount} sub="Visible on storefront" tone="slate" />
        <MetricCard icon={<CreditCard className="h-5 w-5" />} label="Pending payments" value={metrics.pendingTransactionCount} sub="Awaiting confirmation" tone="amber" />
      </div>

      {overview ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-500 shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-700">{overview.mode === 'full' ? 'Full account view' : 'Transaction-backed'}</span>
          </span>
          <span className="hidden text-slate-300 sm:inline">·</span>
          <span>Last refreshed: <span className="font-medium text-slate-700">{formatDateTime(overview.refreshedAt)}</span></span>
        </div>
      ) : null}
    </div>
  );
}

// ─── Accounts Tab ────────────────────────────────────────────────────────────

function AccountsTab({
  filteredUsers, selectedUser, searchValue, onSearch, onSelectUser,
  selectedTransactions, selectedOrders, activeTarget,
  reviewNote, reviewPriority, actionState,
  onReviewNoteChange, onReviewPriorityChange, onCreateReview,
}) {
  const [showDetail, setShowDetail] = useState(false);

  const handleSelectUser = (userKey) => {
    onSelectUser(userKey);
    setShowDetail(true);
  };

  const handleBack = () => setShowDetail(false);

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">Accounts</h2>
        <p className="mt-0.5 text-sm text-slate-500">Search customers, inspect orders, and create review requests.</p>
      </div>

      {/* Mobile: toggle list ↔ detail */}
      {showDetail && selectedUser ? (
        <div className="xl:hidden">
          <button type="button" onClick={handleBack}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <ChevronLeft className="h-4 w-4" /> Back to accounts
          </button>
          <AccountDetail
            selectedUser={selectedUser}
            selectedTransactions={selectedTransactions}
            selectedOrders={selectedOrders}
            activeTarget={activeTarget}
            reviewNote={reviewNote}
            reviewPriority={reviewPriority}
            actionState={actionState}
            onReviewNoteChange={onReviewNoteChange}
            onReviewPriorityChange={onReviewPriorityChange}
            onCreateReview={onCreateReview}
          />
        </div>
      ) : (
        <div className="xl:hidden">
          <AccountsList
            filteredUsers={filteredUsers}
            selectedUser={selectedUser}
            searchValue={searchValue}
            onSearch={onSearch}
            onSelectUser={handleSelectUser}
          />
        </div>
      )}

      {/* Desktop: side-by-side */}
      <div className="hidden xl:grid xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-6">
        <AccountsList
          filteredUsers={filteredUsers}
          selectedUser={selectedUser}
          searchValue={searchValue}
          onSearch={onSearch}
          onSelectUser={onSelectUser}
        />
        {selectedUser ? (
          <AccountDetail
            selectedUser={selectedUser}
            selectedTransactions={selectedTransactions}
            selectedOrders={selectedOrders}
            activeTarget={activeTarget}
            reviewNote={reviewNote}
            reviewPriority={reviewPriority}
            actionState={actionState}
            onReviewNoteChange={onReviewNoteChange}
            onReviewPriorityChange={onReviewPriorityChange}
            onCreateReview={onCreateReview}
          />
        ) : (
          <EmptyState icon={Users} title="No account selected" body="Choose a customer from the list to inspect their activity." />
        )}
      </div>
    </div>
  );
}

function AccountsList({ filteredUsers, selectedUser, searchValue, onSearch, onSelectUser }) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search" value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
          className="input-shell pl-10"
          placeholder="Search name, email, or reference"
        />
      </div>
      <div className="space-y-2 sm:max-h-[70vh] sm:overflow-y-auto xl:max-h-[calc(100vh-18rem)]">
        {filteredUsers.length ? filteredUsers.map((user) => (
          <button key={user.key} type="button" onClick={() => onSelectUser(user.key)}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              selectedUser?.key === user.key
                ? 'border-blue-300 bg-blue-50 shadow-[0_4px_16px_-4px_rgba(37,99,235,0.2)]'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{user.name}</div>
                  <div className="truncate text-xs text-slate-500">{user.email || 'No email'}</div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-slate-900">{formatCurrency(user.totalSpent)}</div>
                <div className="text-xs text-slate-400">{user.orderCount} orders</div>
              </div>
            </div>
          </button>
        )) : (
          <EmptyState icon={Search} title="No matching accounts" body="Try a different search term." />
        )}
      </div>
    </div>
  );
}

function AccountDetail({ selectedUser, selectedTransactions, selectedOrders, activeTarget, reviewNote, reviewPriority, actionState, onReviewNoteChange, onReviewPriorityChange, onCreateReview }) {
  const [openSection, setOpenSection] = useState('images');
  const imageCount = buildUserImageRows(selectedUser, selectedOrders).length;
  const sections = [
    { id: 'images',       label: `Images (${imageCount})` },
    { id: 'profile',      label: 'Profile' },
    { id: 'review',       label: 'Create Request' },
    { id: 'orders',       label: `Orders (${selectedOrders.length})` },
    { id: 'transactions', label: `Transactions (${selectedTransactions.length})` },
  ];

  return (
    <div className="space-y-4">
      {/* Account header */}
      <CardShell className="p-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl font-bold text-blue-700">
            {selectedUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-slate-900">{selectedUser.name}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Pill>{selectedUser.email || 'No email'}</Pill>
              <Pill tone="blue">{titleize(selectedUser.role || 'customer')}</Pill>
              <Pill tone={selectedUser.source === 'profile' ? 'emerald' : 'amber'}>
                {selectedUser.source === 'profile' ? 'Verified' : 'Transaction-backed'}
              </Pill>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniDetail icon={<ReceiptText className="h-4 w-4" />} label="Orders" value={selectedUser.orderCount} />
          <MiniDetail icon={<CreditCard className="h-4 w-4" />} label="Transactions" value={selectedUser.transactionCount} />
          <MiniDetail icon={<ImageIcon className="h-4 w-4" />} label="Images" value={imageCount} />
          <MiniDetail icon={<Wallet className="h-4 w-4" />} label="Total spent" value={formatCurrency(selectedUser.totalSpent)} />
        </div>
      </CardShell>

      {/* Sub-tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {sections.map((s) => (
          <button key={s.id} type="button" onClick={() => setOpenSection(s.id)}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
              openSection === s.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {openSection === 'images' && (
        <CustomerImageDashboard selectedUser={selectedUser} selectedOrders={selectedOrders} />
      )}

      {/* Profile sub-tab */}
      {openSection === 'profile' && (
        <CardShell className="p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniDetail icon={<Mail className="h-4 w-4" />} label="Email" value={selectedUser.email || 'Not captured'} />
            <MiniDetail icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedUser.phone || 'Not captured'} />
            <MiniDetail icon={<Users className="h-4 w-4" />} label="Created" value={formatDate(selectedUser.createdAt) || 'Unknown'} />
            <MiniDetail icon={<CheckCircle2 className="h-4 w-4" />} label="Latest activity" value={formatDateTime(selectedUser.latestActivityAt)} />
          </div>
        </CardShell>
      )}

      {/* Create review sub-tab */}
      {openSection === 'review' && (
        <CardShell className="p-5">
          <SectionHeading title="Create review request" subtitle="Queue a review or retouch job against the latest order on this account." />
          {activeTarget ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Targeting <span className="font-semibold text-slate-900">{activeTarget.reference || activeTarget.paymentReference || activeTarget.id}</span>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              No order or transaction available for request actions.
            </div>
          )}
          <div className="space-y-4">
            <textarea
              value={reviewNote}
              onChange={(e) => onReviewNoteChange(e.target.value)}
              rows={3}
              className="input-shell rounded-2xl"
              placeholder="Add context for the review team…"
            />
            <label className="block">
              <div className="mb-1.5 text-sm font-semibold text-slate-700">Priority</div>
              <select value={reviewPriority} onChange={(e) => onReviewPriorityChange(e.target.value)} className="input-shell">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button"
                onClick={() => onCreateReview('manual_review')}
                disabled={!activeTarget || actionState.status === 'loading'}
                className="primary-button flex-1 justify-center text-sm">
                {actionState.status === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                Manual review
              </button>
              <button type="button"
                onClick={() => onCreateReview('premium_retouch')}
                disabled={!activeTarget || actionState.status === 'loading'}
                className="secondary-button flex-1 justify-center text-sm">
                <Sparkles className="h-4 w-4" />
                Premium retouch
              </button>
              <button type="button"
                onClick={() => onCreateReview('compliance_check')}
                disabled={!activeTarget || actionState.status === 'loading'}
                className="secondary-button flex-1 justify-center text-sm">
                <ShieldCheck className="h-4 w-4" />
                Compliance check
              </button>
              <button type="button"
                onClick={() => onCreateReview('photo_retouching')}
                disabled={!activeTarget || actionState.status === 'loading'}
                className="secondary-button flex-1 justify-center text-sm">
                <Sparkles className="h-4 w-4" />
                Photo retouching
              </button>
            </div>
          </div>
          <StatusBanner state={actionState} />
        </CardShell>
      )}

      {/* Orders sub-tab */}
      {openSection === 'orders' && (
        <div className="space-y-3">
          {selectedOrders.length ? selectedOrders.map((order) => {
            const orderItem = getPrimaryOrderItem(order);
            const downloadOwner = order.customerName || order.customerEmail || order.id || 'customer';
            const orderItems = Array.isArray(order.items) ? order.items : [];

            return (
            <CardShell key={order.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{order.id}</div>
                  <div className="truncate text-sm text-slate-500">{order.serviceSummary}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {order.customerEmail ? <Pill>{order.customerEmail}</Pill> : null}
                    {order.customerName ? <Pill tone="blue">{order.customerName}</Pill> : null}
                    {order.deliveryEmail ? <Pill tone="blue">Delivery: {order.deliveryEmail}</Pill> : null}
                    {order.customerPhone ? <Pill tone="amber">{order.customerPhone}</Pill> : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Pill tone="emerald">{order.status}</Pill>
                  {order.premiumRetouch ? <Pill tone="blue">Premium</Pill> : null}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MiniDetail icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Verified" value={formatDateTime(order.paymentVerifiedAt || order.date)} />
                <MiniDetail icon={<Wallet className="h-3.5 w-3.5" />} label="Total" value={formatCurrency(order.total)} />
                <MiniDetail icon={<CreditCard className="h-3.5 w-3.5" />} label="Reference" value={order.paymentReference} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <MiniDetail icon={<Users className="h-3.5 w-3.5" />} label="Package" value={describeOrderOptions(order) || 'Not captured'} />
                <MiniDetail icon={<Mail className="h-3.5 w-3.5" />} label="Receipt email" value={order.receiptEmail || order.customerEmail || 'Not captured'} />
                <MiniDetail icon={<Phone className="h-3.5 w-3.5" />} label="Shipping" value={formatAddress(order.shippingAddress)} />
              </div>
              {orderItems.length ? (
                <div className="mt-3 space-y-3">
                  {orderItems.map((item, index) => (
                    <OrderItemImages
                      key={item.id || item.resultId || `${order.id}-${index}`}
                      item={item}
                      ownerName={downloadOwner}
                      fallbackLabel={order.documentLabel || order.serviceSummary || 'Passport photo'}
                    />
                  ))}
                </div>
              ) : (order.sourceImageUrl || order.processedImageUrl) ? (
                <div className="mt-3">
                  <OrderItemImages
                    item={orderItem || order}
                    ownerName={downloadOwner}
                    fallbackLabel={order.documentLabel || order.serviceSummary || 'Passport photo'}
                  />
                </div>
              ) : null}
            </CardShell>
          );}) : <EmptyState title="No saved orders" body="A paid order will appear here once completed." />}
        </div>
      )}

      {/* Transactions sub-tab */}
      {openSection === 'transactions' && (
        <div className="space-y-3">
          {selectedTransactions.length ? selectedTransactions.map((tx) => {
            const txTone = tx.status === 'success' ? 'emerald' : ['pending','ongoing','processing','queued'].includes(tx.status) ? 'amber' : 'red';
            return (
              <CardShell key={tx.reference} className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{tx.reference}</div>
                    <div className="truncate text-sm text-slate-500">{tx.documentLabel}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Pill tone={txTone}>{titleize(tx.status)}</Pill>
                    {tx.premiumRetouch ? <Pill tone="blue">Premium</Pill> : null}
                  </div>
                </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MiniDetail icon={<Wallet className="h-3.5 w-3.5" />} label="Amount" value={formatCurrency(tx.amount)} />
                <MiniDetail icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Paid" value={formatDateTime(tx.paidAt || tx.createdAt)} />
                <MiniDetail icon={<CreditCard className="h-3.5 w-3.5" />} label="Channel" value={tx.channel} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <MiniDetail icon={<Users className="h-3.5 w-3.5" />} label="Package" value={describeOrderOptions(tx) || 'Not captured'} />
                <MiniDetail icon={<Mail className="h-3.5 w-3.5" />} label="Delivery email" value={tx.deliveryEmail || tx.customerEmail || 'Not captured'} />
                <MiniDetail icon={<Phone className="h-3.5 w-3.5" />} label="Shipping" value={formatAddress(tx.shippingAddress)} />
              </div>
            </CardShell>
          );
          }) : <EmptyState title="No transactions" body="A payment record appears here once the customer reaches checkout." />}
        </div>
      )}
    </div>
  );
}

// ─── Queue Tab ───────────────────────────────────────────────────────────────

const QUEUE_FILTERS = [
  { id: 'open',        label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed',   label: 'Completed' },
  { id: 'all',         label: 'All' },
];

function QueueTab({ visibleQueueItems, selectedQueueItem, queueFilter, onFilterChange, onSelectItem, queueEditor, onQueueEditorChange, queueState, onSaveQueue }) {
  const [showDetail, setShowDetail] = useState(false);

  const handleSelectItem = (id) => {
    onSelectItem(id);
    setShowDetail(true);
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">Review Queue</h2>
        <p className="text-sm text-slate-500">Manage cleanup, compliance, and retouching requests.</p>
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {QUEUE_FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => onFilterChange(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
              queueFilter === f.id
                ? 'bg-blue-600 text-white shadow-[0_4px_12px_-4px_rgba(37,99,235,0.4)]'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Mobile: toggle list ↔ detail */}
      {showDetail && selectedQueueItem ? (
        <div className="xl:hidden space-y-4">
          <button type="button" onClick={() => setShowDetail(false)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <ChevronLeft className="h-4 w-4" /> Back to queue
          </button>
          <QueueEditor item={selectedQueueItem} editor={queueEditor} onChange={onQueueEditorChange} state={queueState} onSave={onSaveQueue} />
        </div>
      ) : (
        <div className="xl:hidden space-y-2">
          <QueueList items={visibleQueueItems} selectedItem={selectedQueueItem} onSelect={handleSelectItem} />
        </div>
      )}

      {/* Desktop: side-by-side */}
      <div className="hidden xl:grid xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6">
        <QueueList items={visibleQueueItems} selectedItem={selectedQueueItem} onSelect={onSelectItem} />
        {selectedQueueItem ? (
          <QueueEditor item={selectedQueueItem} editor={queueEditor} onChange={onQueueEditorChange} state={queueState} onSave={onSaveQueue} />
        ) : (
          <EmptyState icon={ListChecks} title="No item selected" body="Choose a queue entry to update its status and fulfillment notes." />
        )}
      </div>
    </div>
  );
}

function QueueList({ items, selectedItem, onSelect }) {
  if (!items.length) return <EmptyState icon={CheckCircle2} title="Queue is clear" body="No requests match the current filter." />;

  return (
    <div className="space-y-2 sm:max-h-[70vh] sm:overflow-y-auto xl:max-h-[calc(100vh-18rem)]">
      {items.map((item) => {
        const typeTone = item.requestType === 'premium_retouch' ? 'blue' : item.requestType === 'photo_retouching' ? 'emerald' : 'amber';
        const statusTone = item.status === 'completed' ? 'emerald' : item.status === 'in_progress' ? 'blue' : item.status === 'cancelled' ? 'slate' : 'amber';
        const priorityTone = item.priority === 'urgent' ? 'red' : item.priority === 'high' ? 'amber' : item.priority === 'low' ? 'slate' : 'blue';
        const thumbnailUrl = item.fulfilledImageUrl || item.processedImageUrl || item.sourceImageUrl || '';
        return (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              selectedItem?.id === item.id
                ? 'border-blue-300 bg-blue-50 shadow-[0_4px_16px_-4px_rgba(37,99,235,0.2)]'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="h-14 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{item.customerName}</div>
                <div className="truncate text-xs text-slate-500">{item.documentLabel}</div>
              </div>
              <div className="ml-auto shrink-0">
                <Pill tone={typeTone}>{titleize(item.requestType)}</Pill>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Pill tone={statusTone}>{titleize(item.status)}</Pill>
              <Pill tone={priorityTone}>{titleize(item.priority)}</Pill>
            </div>
            <div className="mt-2 truncate text-xs text-slate-500">
              {item.deliveryEmail || item.receiptEmail || item.userEmail || 'No delivery email captured'}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">Updated {formatDateTime(item.updatedAt)}</div>
          </button>
        );
      })}
    </div>
  );
}

function QueueEditor({ item, editor, onChange, state, onSave }) {
  const handleFulfilledImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      onChange({ fulfilledImageUrl: dataUrl });
    } catch {
      onChange({ fulfilledImageUrl: '' });
    } finally {
      event.target.value = '';
    }
  };

  return (
    <CardShell className="p-5">
      <SectionHeading title="Fulfillment editor" subtitle="Update status, assign work, and record the completion note." />

      <div className="mb-5 grid gap-2.5 sm:grid-cols-2">
        <MiniDetail icon={<Users className="h-4 w-4" />} label="Customer" value={item.customerName || 'Not captured'} />
        <MiniDetail icon={<Phone className="h-4 w-4" />} label="Phone" value={item.customerPhone || 'Not captured'} />
        <MiniDetail icon={<Mail className="h-4 w-4" />} label="Receipt email" value={item.receiptEmail || item.userEmail || 'Not captured'} />
        <MiniDetail icon={<Mail className="h-4 w-4" />} label="Delivery email" value={item.deliveryEmail || item.receiptEmail || item.userEmail || 'Not captured'} />
        <MiniDetail icon={<CreditCard className="h-4 w-4" />} label="Reference" value={item.transactionReference || 'Not captured'} />
        <MiniDetail icon={<ReceiptText className="h-4 w-4" />} label="Package" value={describeOrderOptions(item) || 'Not captured'} />
        <MiniDetail icon={<CheckCircle2 className="h-4 w-4" />} label="Created" value={formatDateTime(item.createdAt)} />
        {item.completedAt ? (
          <MiniDetail icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={formatDateTime(item.completedAt)} />
        ) : null}
        <div className="sm:col-span-2">
          <MiniDetail icon={<Phone className="h-4 w-4" />} label="Shipping address" value={formatAddress(item.shippingAddress)} />
        </div>
      </div>

      {(item.sourceImageUrl || item.processedImageUrl || editor.fulfilledImageUrl) ? (
        <div className="mb-5 grid gap-3 lg:grid-cols-2">
          <ImagePreviewCard
            title="Customer upload"
            imageUrl={item.sourceImageUrl}
            alt="Customer upload"
            onDownload={item.sourceImageUrl
              ? () => downloadImageAsset(item.sourceImageUrl, buildAdminDownloadFilename({ ...item, countryLabel: item.documentLabel }, item.customerName || item.userEmail || item.transactionReference, 'original'))
              : null}
          />
          <ImagePreviewCard
            title={editor.fulfilledImageUrl ? 'Final fulfilled image' : 'Current processed image'}
            imageUrl={editor.fulfilledImageUrl || item.fulfilledImageUrl || item.processedImageUrl}
            alt="Processed image"
            onDownload={(editor.fulfilledImageUrl || item.fulfilledImageUrl || item.processedImageUrl)
              ? () => downloadImageAsset(
                editor.fulfilledImageUrl || item.fulfilledImageUrl || item.processedImageUrl,
                buildAdminDownloadFilename({ ...item, countryLabel: item.documentLabel }, item.customerName || item.userEmail || item.transactionReference, 'processed'),
              )
              : null}
          />
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Status</div>
            <select value={editor.status} onChange={(e) => onChange({ status: e.target.value })} className="input-shell">
              <option value="requested">Requested</option>
              <option value="queued">Queued</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="block">
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Priority</div>
            <select value={editor.priority} onChange={(e) => onChange({ priority: e.target.value })} className="input-shell">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
        </div>
        <label className="block">
          <div className="mb-1.5 text-sm font-semibold text-slate-700">Assignee</div>
          <input type="text" value={editor.assignee} onChange={(e) => onChange({ assignee: e.target.value })} className="input-shell" placeholder="Initials or team member" />
        </label>
        <label className="block">
          <div className="mb-1.5 text-sm font-semibold text-slate-700">Request note</div>
          <textarea value={editor.note} onChange={(e) => onChange({ note: e.target.value })} rows={3} className="input-shell rounded-2xl" />
        </label>
        <label className="block">
          <div className="mb-1.5 text-sm font-semibold text-slate-700">Fulfillment note</div>
          <textarea value={editor.fulfillmentNote} onChange={(e) => onChange({ fulfillmentNote: e.target.value })} rows={4} className="input-shell rounded-2xl" placeholder="What was corrected and what was delivered." />
        </label>
        <label className="block">
          <div className="mb-1.5 text-sm font-semibold text-slate-700">Fulfilled image</div>
          <input type="file" accept="image/*" onChange={handleFulfilledImageChange} className="input-shell pt-3" />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Upload the final retouched or approved image that should be attached to the customer's order.
          </p>
        </label>
        {editor.fulfilledImageUrl ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <img src={editor.fulfilledImageUrl} alt="Fulfilled upload preview" className="w-full rounded-xl object-contain bg-white" />
          </div>
        ) : null}
      </div>

      <StatusBanner state={state} />

      <button type="button" onClick={onSave} disabled={state.status === 'loading'} className="primary-button mt-5 w-full justify-center">
        {state.status === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Save fulfillment update
      </button>
    </CardShell>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────────────

function SettingsTab({
  settingsForm,
  settingsState,
  onUpdatePrice,
  onToggleActive,
  onPremiumFeeChange,
  onDigitalPrint2CopyFeeChange,
  onDigitalPrint4CopyFeeChange,
  onDigitalPrint6CopyFeeChange,
  onComplianceCheckFeeChange,
  onPhotoRetouchingFeeChange,
  onSave,
  activeDocumentCount,
}) {
  const usPassportPrice = settingsForm.documents.find((doc) => doc.documentId === 'us-passport')?.price ?? 0;
  const usBabyPassportPrice = settingsForm.documents.find((doc) => doc.documentId === 'us-baby-passport')?.price ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Settings</h2>
          <p className="mt-0.5 text-sm text-slate-500">Edit live checkout prices. Changes apply after save — no redeploy needed.</p>
        </div>
        <Pill tone="blue">{activeDocumentCount} active format{activeDocumentCount !== 1 ? 's' : ''}</Pill>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['US Passport', formatCurrency(usPassportPrice)],
          ['US Baby Passport', formatCurrency(usBabyPassportPrice)],
          ['2 prints', formatCurrency(settingsForm.digitalPrint2CopyFee)],
          ['4 prints', formatCurrency(settingsForm.digitalPrint4CopyFee)],
          ['6 prints', formatCurrency(settingsForm.digitalPrint6CopyFee)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_2px_12px_-8px_rgba(15,23,42,0.18)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
            <div className="mt-1 text-xl font-bold tracking-tight text-slate-950">{value}</div>
          </div>
        ))}
      </div>

      {/* Premium fee */}
      <CardShell className="p-5">
        <SectionHeading title="Checkout pricing" subtitle="Set placeholder prices here so storefront totals update without a redeploy." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Premium cleanup</div>
            <input
              type="number" min="0" step="0.01"
              value={settingsForm.premiumRetouchFee}
              onChange={(e) => onPremiumFeeChange(Number(e.target.value || 0))}
              className="input-shell"
            />
          </label>
          <label className="block">
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Printouts: 2 copies</div>
            <input type="number" min="0" step="0.01" value={settingsForm.digitalPrint2CopyFee} onChange={(e) => onDigitalPrint2CopyFeeChange(Number(e.target.value || 0))} className="input-shell" />
          </label>
          <label className="block">
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Printouts: 4 copies</div>
            <input type="number" min="0" step="0.01" value={settingsForm.digitalPrint4CopyFee} onChange={(e) => onDigitalPrint4CopyFeeChange(Number(e.target.value || 0))} className="input-shell" />
          </label>
          <label className="block">
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Printouts: 6 copies</div>
            <input type="number" min="0" step="0.01" value={settingsForm.digitalPrint6CopyFee} onChange={(e) => onDigitalPrint6CopyFeeChange(Number(e.target.value || 0))} className="input-shell" />
          </label>
          <label className="block">
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Compliance check</div>
            <input type="number" min="0" step="0.01" value={settingsForm.complianceCheckFee} onChange={(e) => onComplianceCheckFeeChange(Number(e.target.value || 0))} className="input-shell" />
          </label>
          <label className="block">
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Photo retouching</div>
            <input type="number" min="0" step="0.01" value={settingsForm.photoRetouchingFee} onChange={(e) => onPhotoRetouchingFeeChange(Number(e.target.value || 0))} className="input-shell" />
          </label>
        </div>
      </CardShell>

      {/* Document catalog */}
      <CardShell className="p-5">
        <SectionHeading title="Document catalog" subtitle="Hide formats or adjust prices without redeploying." />

        <div className="space-y-3">
          {settingsForm.documents.map((doc) => {
            const meta = getDocumentById(doc.documentId);
            return (
              <div key={doc.documentId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{meta?.name || doc.documentId}</div>
                    <div className="text-xs text-slate-400">{doc.documentId}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {doc.isActive ? 'Visible on storefront' : 'Hidden from new orders'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Price</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={doc.price}
                        onChange={(e) => onUpdatePrice(doc.documentId, e.target.value)}
                        className="input-shell w-28"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onToggleActive(doc.documentId)}
                      disabled={doc.isActive && activeDocumentCount <= 1}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        doc.isActive
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {doc.isActive ? 'Active' : 'Hidden'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardShell>

      <StatusBanner state={settingsState} />

      <div className="flex justify-end">
        <button type="button" onClick={onSave} disabled={settingsState.status === 'loading'} className="primary-button justify-center px-8">
          {settingsState.status === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
          Save live settings
        </button>
      </div>
    </div>
  );
}

// ─── Main Admin Shell ────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: BarChart2 },
  { id: 'accounts',  label: 'Accounts',  icon: Users },
  { id: 'queue',     label: 'Queue',     icon: ListChecks },
  { id: 'settings',  label: 'Settings',  icon: Settings2 },
];

export function AdminView({ onSiteSettingsChange = null }) {
  const [session, setSession]       = useState(getStoredAdminSession);
  const [overview, setOverview]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab]   = useState('overview');

  const [selectedUserKey,  setSelectedUserKey]  = useState('');
  const [selectedQueueId,  setSelectedQueueId]  = useState('');
  const [searchValue,      setSearchValue]      = useState('');
  const [queueFilter,      setQueueFilter]      = useState('open');
  const [reviewNote,       setReviewNote]       = useState('');
  const [reviewPriority,   setReviewPriority]   = useState('normal');
  const [actionState,      setActionState]      = useState({ status: 'idle', message: '' });
  const [queueEditor,      setQueueEditor]      = useState({ status: 'requested', priority: 'normal', assignee: '', note: '', fulfillmentNote: '', fulfilledImageUrl: '' });
  const [queueState,       setQueueState]       = useState({ status: 'idle', message: '' });
  const [settingsForm,     setSettingsForm]     = useState(() => normalizeSiteSettings({}));
  const [settingsState,    setSettingsState]    = useState({ status: 'idle', message: '' });

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadOverview = async (token, preferredUserKey = selectedUserKey, preferredQueueId = selectedQueueId) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const nextOverview = await fetchAdminOverview(token);
      const users = Array.isArray(nextOverview.users) ? nextOverview.users : [];
      const reviewRequests = Array.isArray(nextOverview.reviewRequests) ? nextOverview.reviewRequests : [];
      setOverview(nextOverview);
      setSettingsForm(normalizeSiteSettings(nextOverview.settings || {}));

      if (!users.length) setSelectedUserKey('');
      else if (preferredUserKey && users.some((u) => u.key === preferredUserKey)) setSelectedUserKey(preferredUserKey);
      else setSelectedUserKey(users[0].key);

      if (!reviewRequests.length) setSelectedQueueId('');
      else if (preferredQueueId && reviewRequests.some((r) => r.id === preferredQueueId)) setSelectedQueueId(preferredQueueId);
      else setSelectedQueueId(reviewRequests[0].id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the admin dashboard.';
      if (message.toLowerCase().includes('denied')) { clearAdminSession(); setSession(null); }
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.token) return;
    loadOverview(session.token, selectedUserKey, selectedQueueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  // ── Auth ───────────────────────────────────────────────────────────────────

  const handleLogin = async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const email    = String(fd.get('email')    || '').trim();
    const password = String(fd.get('password') || '').trim();
    setLoading(true);
    setErrorMessage('');
    try {
      const nextSession = await adminLogin(email, password);
      setSession(nextSession);
      setActionState({ status: 'idle', message: '' });
      setQueueState({ status: 'idle', message: '' });
      setSettingsState({ status: 'idle', message: '' });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    setSession(null);
    setOverview(null);
    setSelectedUserKey('');
    setSelectedQueueId('');
    setReviewNote('');
    setReviewPriority('normal');
    setActionState({ status: 'idle', message: '' });
    setQueueState({ status: 'idle', message: '' });
    setSettingsState({ status: 'idle', message: '' });
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const users = Array.isArray(overview?.users) ? overview.users : [];
  const filteredUsers = users.filter((user) => {
    const haystack = [user.name, user.email, user.phone,
      ...(user.transactions || []).map((t) => t.reference),
      ...(user.orders      || []).map((o) => o.paymentReference || o.id),
    ].join(' ').toLowerCase();
    return haystack.includes(searchValue.trim().toLowerCase());
  });
  const selectedUser =
    filteredUsers.find((u) => u.key === selectedUserKey) ||
    users.find((u) => u.key === selectedUserKey) ||
    filteredUsers[0] || users[0] || null;

  const metrics = overview?.metrics || {
    accountCount: 0, transactionCount: 0, revenue: 0,
    premiumQueueCount: 0, manualQueueCount: 0,
    pendingTransactionCount: 0, paidTransactionCount: 0,
    activeDocumentCount: 0, queuedReviewCount: 0, inProgressReviewCount: 0,
  };

  const queueItems = Array.isArray(overview?.reviewRequests) ? overview.reviewRequests : [];
  const visibleQueueItems = queueItems.filter((item) => {
    if (queueFilter === 'all')         return true;
    if (queueFilter === 'completed')   return item.status === 'completed';
    if (queueFilter === 'in_progress') return item.status === 'in_progress';
    return !['completed', 'cancelled'].includes(item.status);
  });
  const selectedQueueItem =
    visibleQueueItems.find((i) => i.id === selectedQueueId) ||
    queueItems.find((i) => i.id === selectedQueueId) ||
    visibleQueueItems[0] || queueItems[0] || null;

  // ── Queue editor sync — must sit after derived state ──────────────────────

  useEffect(() => {
    if (!selectedQueueItem) return;
    setQueueEditor({
      status:          selectedQueueItem.status || 'requested',
      priority:        selectedQueueItem.priority || 'normal',
      assignee:        selectedQueueItem.assignee || '',
      note:            selectedQueueItem.note || '',
      fulfillmentNote: selectedQueueItem.fulfillmentNote || '',
      fulfilledImageUrl: selectedQueueItem.fulfilledImageUrl || '',
    });
  }, [selectedQueueItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visibleQueueItems.length) return;
    if (!visibleQueueItems.some((item) => item.id === selectedQueueId)) {
      setSelectedQueueId(visibleQueueItems[0].id);
    }
  }, [selectedQueueId, visibleQueueItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTransactions = selectedUser?.transactions || [];
  const selectedOrders       = selectedUser?.orders       || [];
  const activeTarget         = selectedTransactions[0] || selectedOrders[0] || null;
  const activeDocumentCount  = settingsForm.documents.filter((d) => d.isActive).length;

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    if (!session?.token) return;
    await loadOverview(session.token, selectedUser?.key || '', selectedQueueItem?.id || '');
  };

  const handleCreateReviewRequest = async (requestType) => {
    if (!session?.token || !selectedUser || !activeTarget) return;
    setActionState({ status: 'loading', message: '' });
    try {
      const saved = await saveAdminReviewRequest(session.token, {
        userKey: selectedUser.key, userEmail: selectedUser.email,
        customerName: selectedUser.name, requestType,
        status: 'requested', priority: reviewPriority, note: reviewNote,
        targetId:             activeTarget.reference || activeTarget.paymentReference || activeTarget.id,
        transactionReference: activeTarget.reference || activeTarget.paymentReference || activeTarget.id,
        documentLabel:        activeTarget.documentLabel || activeTarget.serviceSummary || 'Passport photo',
        customerPhone: activeTarget.customerPhone || selectedUser.phone || '',
        receiptEmail: activeTarget.receiptEmail || activeTarget.customerEmail || selectedUser.email || '',
        deliveryEmail: activeTarget.deliveryEmail || activeTarget.customerEmail || selectedUser.email || '',
        sourceImageUrl: activeTarget.sourceImageUrl || '',
        processedImageUrl: activeTarget.processedImageUrl || '',
        fulfilledImageUrl: activeTarget.fulfilledImageUrl || '',
        shippingAddress: activeTarget.shippingAddress || null,
        customerFirstName: activeTarget.customerFirstName || '',
        customerLastName: activeTarget.customerLastName || '',
        paymentReference: activeTarget.paymentReference || activeTarget.reference || activeTarget.id,
        photoPackage: activeTarget.photoPackage || 'digital',
        printCopies: activeTarget.printCopies || 2,
        complianceCheck: Boolean(activeTarget.complianceCheck),
        photoRetouching: Boolean(activeTarget.photoRetouching),
        premiumRetouch: Boolean(activeTarget.premiumRetouch),
      });
      setReviewNote('');
      setReviewPriority('normal');
      setActionState({ status: 'success', message: `${titleize(requestType)} queued for ${selectedUser.name}.` });
      await loadOverview(session.token, selectedUser.key, saved.id);
    } catch (error) {
      setActionState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to update the review queue.' });
    }
  };

  const handleSaveQueueRequest = async () => {
    if (!session?.token || !selectedQueueItem) return;
    setQueueState({ status: 'loading', message: '' });
    try {
      const saved = await saveAdminReviewRequest(session.token, {
        id: selectedQueueItem.id, targetId: selectedQueueItem.targetId,
        userKey: selectedQueueItem.userKey, userEmail: selectedQueueItem.userEmail,
        customerName: selectedQueueItem.customerName, documentLabel: selectedQueueItem.documentLabel,
        transactionReference: selectedQueueItem.transactionReference, requestType: selectedQueueItem.requestType,
        status: queueEditor.status, priority: queueEditor.priority,
        assignee: queueEditor.assignee, note: queueEditor.note, fulfillmentNote: queueEditor.fulfillmentNote,
        fulfilledImageUrl: queueEditor.fulfilledImageUrl,
        sourceImageUrl: selectedQueueItem.sourceImageUrl,
        processedImageUrl: selectedQueueItem.processedImageUrl,
        receiptEmail: selectedQueueItem.receiptEmail,
        deliveryEmail: selectedQueueItem.deliveryEmail,
        customerPhone: selectedQueueItem.customerPhone,
        paymentReference: selectedQueueItem.paymentReference,
        shippingAddress: selectedQueueItem.shippingAddress,
        customerFirstName: selectedQueueItem.customerFirstName,
        customerLastName: selectedQueueItem.customerLastName,
        photoPackage: selectedQueueItem.photoPackage,
        printCopies: selectedQueueItem.printCopies,
        complianceCheck: selectedQueueItem.complianceCheck,
        photoRetouching: selectedQueueItem.photoRetouching,
        premiumRetouch: selectedQueueItem.premiumRetouch,
      });
      setQueueState({ status: 'success', message: `Queue item ${saved.transactionReference} saved.` });
      await loadOverview(session.token, selectedUser?.key || '', saved.id);
    } catch (error) {
      setQueueState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to save the queue item.' });
    }
  };

  const handleSaveSettings = async () => {
    if (!session?.token) return;
    setSettingsState({ status: 'loading', message: '' });
    try {
      const saved = await saveAdminSiteSettings(session.token, settingsForm);
      const normalized = normalizeSiteSettings(saved);
      setSettingsForm(normalized);
      setSettingsState({ status: 'success', message: 'Live settings saved.' });
      if (typeof onSiteSettingsChange === 'function') onSiteSettingsChange(normalized);
      await loadOverview(session.token, selectedUser?.key || '', selectedQueueItem?.id || '');
    } catch (error) {
      setSettingsState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to save settings.' });
    }
  };

  const updateDocumentSetting = (documentId, updates) => {
    setSettingsState({ status: 'idle', message: '' });
    setSettingsForm((current) => ({
      ...current,
      documents: current.documents.map((d) => d.documentId === documentId ? { ...d, ...updates } : d),
    }));
  };

  const handleToggleDocumentActive = (documentId) => {
    const doc = settingsForm.documents.find((d) => d.documentId === documentId);
    if (!doc) return;
    if (doc.isActive && activeDocumentCount <= 1) {
      setSettingsState({ status: 'error', message: 'At least one document format must stay active.' });
      return;
    }
    updateDocumentSetting(documentId, { isActive: !doc.isActive });
  };

  // ── Login gate ─────────────────────────────────────────────────────────────

  if (!session?.token) {
    return <LoginGate loading={loading} errorMessage={errorMessage} onSubmit={handleLogin} />;
  }

  // ── Dashboard shell ────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/80">

      {/* Top header bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_8px_-2px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#1d4ed8,#2563eb)] shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)]">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900">PassportSnap</span>
              <span className="ml-1.5 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Refreshing…
              </span>
            )}
            <button type="button" onClick={handleRefresh} disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40">
              <RefreshCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              <LogOut className="h-4 w-4 text-slate-400" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col xl:flex-row">

        {/* Desktop sidebar nav */}
        <nav className="hidden xl:flex xl:w-60 xl:shrink-0 xl:flex-col xl:border-r xl:border-slate-200 xl:bg-white">
          <div className="flex-1 space-y-0.5 px-3 py-5">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Navigation</p>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  activeTab === id
                    ? 'bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}>
                <Icon className={`h-4 w-4 shrink-0 ${activeTab === id ? 'text-blue-600' : 'text-slate-400'}`} />
                {label}
                {id === 'queue' && metrics.queuedReviewCount > 0 ? (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1 text-[11px] font-bold text-amber-700">
                    {metrics.queuedReviewCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 px-4 py-4">
            <p className="text-[11px] text-slate-400">Signed in as admin</p>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 px-4 py-6 sm:px-6 pb-24 xl:pb-6">
          {errorMessage ? (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
          ) : null}

          {activeTab === 'overview' && (
            <OverviewTab metrics={metrics} overview={overview} loading={loading} onRefresh={handleRefresh} />
          )}
          {activeTab === 'accounts' && (
            <AccountsTab
              filteredUsers={filteredUsers}
              selectedUser={selectedUser}
              searchValue={searchValue}
              onSearch={setSearchValue}
              onSelectUser={setSelectedUserKey}
              selectedTransactions={selectedTransactions}
              selectedOrders={selectedOrders}
              activeTarget={activeTarget}
              reviewNote={reviewNote}
              reviewPriority={reviewPriority}
              actionState={actionState}
              onReviewNoteChange={setReviewNote}
              onReviewPriorityChange={setReviewPriority}
              onCreateReview={handleCreateReviewRequest}
            />
          )}
          {activeTab === 'queue' && (
            <QueueTab
              visibleQueueItems={visibleQueueItems}
              selectedQueueItem={selectedQueueItem}
              queueFilter={queueFilter}
              onFilterChange={setQueueFilter}
              onSelectItem={setSelectedQueueId}
              queueEditor={queueEditor}
              onQueueEditorChange={(patch) => setQueueEditor((c) => ({ ...c, ...patch }))}
              queueState={queueState}
              onSaveQueue={handleSaveQueueRequest}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              settingsForm={settingsForm}
              settingsState={settingsState}
              activeDocumentCount={activeDocumentCount}
              onUpdatePrice={(id, val) => updateDocumentSetting(id, { price: Number(val || 0) })}
              onToggleActive={handleToggleDocumentActive}
              onPremiumFeeChange={(val) => setSettingsForm((c) => ({ ...c, premiumRetouchFee: val }))}
              onDigitalPrint2CopyFeeChange={(val) => setSettingsForm((c) => ({ ...c, digitalPrintFee: val, digitalPrint2CopyFee: val }))}
              onDigitalPrint4CopyFeeChange={(val) => setSettingsForm((c) => ({ ...c, digitalPrint4CopyFee: val }))}
              onDigitalPrint6CopyFeeChange={(val) => setSettingsForm((c) => ({ ...c, digitalPrint6CopyFee: val }))}
              onComplianceCheckFeeChange={(val) => setSettingsForm((c) => ({ ...c, complianceCheckFee: val }))}
              onPhotoRetouchingFeeChange={(val) => setSettingsForm((c) => ({ ...c, photoRetouchingFee: val }))}
              onSave={handleSaveSettings}
            />
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white xl:hidden">
        <div className="flex">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)}
              className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-semibold transition ${
                activeTab === id ? 'text-blue-600' : 'text-slate-400'
              }`}>
              <Icon className="h-5 w-5" />
              {label}
              {activeTab === id && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-blue-600" />
              )}
              {id === 'queue' && metrics.queuedReviewCount > 0 ? (
                <span className="absolute right-[calc(50%-20px)] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-white">
                  {metrics.queuedReviewCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
