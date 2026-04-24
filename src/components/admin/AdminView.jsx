import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
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
import { formatCurrency, formatDate } from '../../lib/utils/formatters';

function formatDateTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function titleize(value = '') {
  return String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function Pill({ children, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function MetricCard({ icon, label, value, copy }) {
  return (
    <div className="surface-card p-5 sm:p-6 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{value}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">{copy}</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function LoginGate({ loading, errorMessage, onSubmit }) {
  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="surface-card overflow-hidden animate-scale-in">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white sm:px-8 sm:py-12">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.28),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_28%)]" />
              <div className="relative space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                  <ShieldCheck className="h-4 w-4" />
                  Hidden admin route
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Admin control center</h1>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                    Manage live pricing, active document formats, premium retouch requests, and the customer transaction ledger from one protected workspace.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-blue-100">Operations</div>
                    <div className="mt-2 text-sm font-semibold text-white">Pricing and catalog controls</div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-blue-100">Fulfillment</div>
                    <div className="mt-2 text-sm font-semibold text-white">Queue triage and completion notes</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-10 sm:px-8 sm:py-12">
              <div className="mx-auto max-w-md">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Admin login</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Sign in to continue</h2>
                <form onSubmit={onSubmit} className="mt-8 space-y-5">
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">Email</div>
                    <input type="text" name="email" defaultValue="admin" className="input-shell" required autoComplete="username" />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">Password</div>
                    <input type="password" name="password" defaultValue="admin" className="input-shell" required autoComplete="current-password" />
                  </label>
                  {errorMessage ? (
                    <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-700">{errorMessage}</div>
                  ) : null}
                  <button type="submit" disabled={loading} className="primary-button w-full justify-center py-4 text-base">
                    {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                    Open dashboard
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ title, copy }) {
  return (
    <div className="surface-card px-6 py-12 text-center">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{copy}</p>
    </div>
  );
}

function UserListCard({ user, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[28px] border p-4 text-left transition ${
        active
          ? 'border-blue-300 bg-blue-50 shadow-[0_20px_44px_-30px_rgba(37,99,235,0.38)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{user.name}</div>
          <div className="mt-1 text-sm text-slate-500">{user.email || 'No email captured'}</div>
        </div>
        {active ? <Pill tone="blue">Selected</Pill> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Orders</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{user.orderCount}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Transactions</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{user.transactionCount}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Spent</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(user.totalSpent)}</div>
        </div>
      </div>
    </button>
  );
}

function QueueCard({ item, active, onSelect }) {
  const typeTone = item.requestType === 'premium_retouch' ? 'blue' : 'amber';
  const statusTone =
    item.status === 'completed'
      ? 'emerald'
      : item.status === 'in_progress'
        ? 'blue'
        : item.status === 'cancelled'
          ? 'slate'
          : 'amber';
  const priorityTone =
    item.priority === 'urgent'
      ? 'red'
      : item.priority === 'high'
        ? 'amber'
        : item.priority === 'low'
          ? 'slate'
          : 'blue';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[28px] border p-4 text-left transition ${
        active
          ? 'border-blue-300 bg-blue-50 shadow-[0_20px_44px_-30px_rgba(37,99,235,0.38)]'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{item.customerName}</div>
          <div className="mt-1 text-sm text-slate-500">{item.documentLabel}</div>
        </div>
        <Pill tone={typeTone}>{titleize(item.requestType)}</Pill>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Pill tone={statusTone}>{titleize(item.status)}</Pill>
        <Pill tone={priorityTone}>{titleize(item.priority)}</Pill>
      </div>

      <div className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-400">
        Updated {formatDateTime(item.updatedAt)}
      </div>
    </button>
  );
}

function DetailMiniCard({ icon, label, value }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
          {icon}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, copy }) {
  return (
    <div>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      {copy ? <div className="mt-1 text-sm text-slate-500">{copy}</div> : null}
    </div>
  );
}

function QueueFilterButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function DocumentSettingRow({ document, onUpdatePrice, onToggleActive, disableToggle }) {
  const documentMeta = getDocumentById(document.documentId);

  return (
    <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{documentMeta?.name || document.documentId}</div>
          <div className="mt-1 text-sm text-slate-500">
            {document.documentId}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {document.isActive ? 'Visible on the storefront and checkout.' : 'Hidden from new orders.'}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Price</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={document.price}
              onChange={(event) => onUpdatePrice(event.target.value)}
              className="input-shell w-32"
            />
          </label>
          <button
            type="button"
            onClick={onToggleActive}
            disabled={disableToggle}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              document.isActive
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            } ${disableToggle ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            {document.isActive ? 'Active' : 'Hidden'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminView({ onSiteSettingsChange = null }) {
  const [session, setSession] = useState(getStoredAdminSession);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedUserKey, setSelectedUserKey] = useState('');
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [queueFilter, setQueueFilter] = useState('open');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewPriority, setReviewPriority] = useState('normal');
  const [actionState, setActionState] = useState({ status: 'idle', message: '' });
  const [queueEditor, setQueueEditor] = useState({
    status: 'requested',
    priority: 'normal',
    assignee: '',
    note: '',
    fulfillmentNote: '',
  });
  const [queueState, setQueueState] = useState({ status: 'idle', message: '' });
  const [settingsForm, setSettingsForm] = useState(() => normalizeSiteSettings({}));
  const [settingsState, setSettingsState] = useState({ status: 'idle', message: '' });

  const loadOverview = async (token, preferredUserKey = selectedUserKey, preferredQueueId = selectedQueueId) => {
    setLoading(true);
    setErrorMessage('');

    try {
      const nextOverview = await fetchAdminOverview(token);
      const users = Array.isArray(nextOverview.users) ? nextOverview.users : [];
      const reviewRequests = Array.isArray(nextOverview.reviewRequests) ? nextOverview.reviewRequests : [];
      setOverview(nextOverview);
      setSettingsForm(normalizeSiteSettings(nextOverview.settings || {}));

      if (!users.length) {
        setSelectedUserKey('');
      } else if (preferredUserKey && users.some((user) => user.key === preferredUserKey)) {
        setSelectedUserKey(preferredUserKey);
      } else {
        setSelectedUserKey(users[0].key);
      }

      if (!reviewRequests.length) {
        setSelectedQueueId('');
      } else if (preferredQueueId && reviewRequests.some((item) => item.id === preferredQueueId)) {
        setSelectedQueueId(preferredQueueId);
      } else {
        setSelectedQueueId(reviewRequests[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the admin dashboard.';
      if (message.toLowerCase().includes('denied')) {
        clearAdminSession();
        setSession(null);
      }
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

  const handleLogin = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '').trim();

    setLoading(true);
    setErrorMessage('');

    try {
      const nextSession = await adminLogin(email, password);
      setSession(nextSession);
      setActionState({ status: 'idle', message: '' });
      setQueueState({ status: 'idle', message: '' });
      setSettingsState({ status: 'idle', message: '' });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in to the admin dashboard.');
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

  const users = Array.isArray(overview?.users) ? overview.users : [];
  const filteredUsers = users.filter((user) => {
    const haystack = [
      user.name,
      user.email,
      user.phone,
      ...(user.transactions || []).map((transaction) => transaction.reference),
      ...(user.orders || []).map((order) => order.paymentReference || order.id),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchValue.trim().toLowerCase());
  });
  const selectedUser =
    filteredUsers.find((user) => user.key === selectedUserKey) ||
    users.find((user) => user.key === selectedUserKey) ||
    filteredUsers[0] ||
    users[0] ||
    null;
  const metrics = overview?.metrics || {
    accountCount: 0,
    transactionCount: 0,
    revenue: 0,
    premiumQueueCount: 0,
    manualQueueCount: 0,
    pendingTransactionCount: 0,
    paidTransactionCount: 0,
    activeDocumentCount: 0,
    queuedReviewCount: 0,
  };
  const queueItems = Array.isArray(overview?.reviewRequests) ? overview.reviewRequests : [];
  const visibleQueueItems = queueItems.filter((item) => {
    if (queueFilter === 'all') return true;
    if (queueFilter === 'completed') return item.status === 'completed';
    if (queueFilter === 'in_progress') return item.status === 'in_progress';
    return !['completed', 'cancelled'].includes(item.status);
  });
  const selectedQueueItem =
    visibleQueueItems.find((item) => item.id === selectedQueueId) ||
    queueItems.find((item) => item.id === selectedQueueId) ||
    visibleQueueItems[0] ||
    queueItems[0] ||
    null;
  const selectedTransactions = selectedUser?.transactions || [];
  const selectedOrders = selectedUser?.orders || [];
  const activeTarget = selectedTransactions[0] || selectedOrders[0] || null;
  const activeDocumentCount = settingsForm.documents.filter((document) => document.isActive).length;

  useEffect(() => {
    if (!selectedQueueItem) return;
    setQueueEditor({
      status: selectedQueueItem.status || 'requested',
      priority: selectedQueueItem.priority || 'normal',
      assignee: selectedQueueItem.assignee || '',
      note: selectedQueueItem.note || '',
      fulfillmentNote: selectedQueueItem.fulfillmentNote || '',
    });
  }, [selectedQueueItem]);

  useEffect(() => {
    if (!visibleQueueItems.length) {
      return;
    }

    if (!visibleQueueItems.some((item) => item.id === selectedQueueId)) {
      setSelectedQueueId(visibleQueueItems[0].id);
    }
  }, [selectedQueueId, visibleQueueItems]);

  if (!session?.token) {
    return <LoginGate loading={loading} errorMessage={errorMessage} onSubmit={handleLogin} />;
  }

  const handleRefresh = async () => {
    if (!session?.token) return;
    await loadOverview(session.token, selectedUser?.key || '', selectedQueueItem?.id || '');
  };

  const handleCreateReviewRequest = async (requestType) => {
    if (!session?.token || !selectedUser || !activeTarget) return;

    setActionState({ status: 'loading', message: '' });

    try {
      const savedRequest = await saveAdminReviewRequest(session.token, {
        userKey: selectedUser.key,
        userEmail: selectedUser.email,
        customerName: selectedUser.name,
        requestType,
        status: 'requested',
        priority: reviewPriority,
        note: reviewNote,
        targetId: activeTarget.reference || activeTarget.paymentReference || activeTarget.id,
        transactionReference: activeTarget.reference || activeTarget.paymentReference || activeTarget.id,
        documentLabel: activeTarget.documentLabel || activeTarget.serviceSummary || 'Passport photo',
      });

      setReviewNote('');
      setReviewPriority('normal');
      setActionState({ status: 'success', message: `${titleize(requestType)} queued for ${selectedUser.name}.` });
      await loadOverview(session.token, selectedUser.key, savedRequest.id);
    } catch (error) {
      setActionState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to update the review queue.' });
    }
  };

  const handleSaveQueueRequest = async () => {
    if (!session?.token || !selectedQueueItem) return;

    setQueueState({ status: 'loading', message: '' });

    try {
      const savedRequest = await saveAdminReviewRequest(session.token, {
        id: selectedQueueItem.id,
        targetId: selectedQueueItem.targetId,
        userKey: selectedQueueItem.userKey,
        userEmail: selectedQueueItem.userEmail,
        customerName: selectedQueueItem.customerName,
        documentLabel: selectedQueueItem.documentLabel,
        transactionReference: selectedQueueItem.transactionReference,
        requestType: selectedQueueItem.requestType,
        status: queueEditor.status,
        priority: queueEditor.priority,
        assignee: queueEditor.assignee,
        note: queueEditor.note,
        fulfillmentNote: queueEditor.fulfillmentNote,
      });

      setQueueState({ status: 'success', message: `Queue item ${savedRequest.transactionReference} saved.` });
      await loadOverview(session.token, selectedUser?.key || '', savedRequest.id);
    } catch (error) {
      setQueueState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to save the queue item.' });
    }
  };

  const updateDocumentSetting = (documentId, updates) => {
    setSettingsState({ status: 'idle', message: '' });
    setSettingsForm((current) => ({
      ...current,
      documents: current.documents.map((document) =>
        document.documentId === documentId
          ? { ...document, ...updates }
          : document,
      ),
    }));
  };

  const handleToggleDocumentActive = (documentId) => {
    const currentDocument = settingsForm.documents.find((document) => document.documentId === documentId);
    if (!currentDocument) return;

    if (currentDocument.isActive && activeDocumentCount <= 1) {
      setSettingsState({ status: 'error', message: 'At least one document format must stay active.' });
      return;
    }

    updateDocumentSetting(documentId, { isActive: !currentDocument.isActive });
  };

  const handleSaveSettings = async () => {
    if (!session?.token) return;

    setSettingsState({ status: 'loading', message: '' });

    try {
      const savedSettings = await saveAdminSiteSettings(session.token, settingsForm);
      const normalizedSettings = normalizeSiteSettings(savedSettings);
      setSettingsForm(normalizedSettings);
      setSettingsState({ status: 'success', message: 'Live settings saved.' });

      if (typeof onSiteSettingsChange === 'function') {
        onSiteSettingsChange(normalizedSettings);
      }

      await loadOverview(session.token, selectedUser?.key || '', selectedQueueItem?.id || '');
    } catch (error) {
      setSettingsState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to save settings.' });
    }
  };

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="mx-auto max-w-[1700px] px-4 sm:px-6 lg:px-8">
        <section className="surface-card overflow-hidden animate-scale-in">
          <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.24),_transparent_32%),radial-gradient(circle_at_right_center,_rgba(14,165,233,0.18),_transparent_30%)]" />
            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                  <ShieldCheck className="h-4 w-4" />
                  Admin dashboard
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Operations, pricing, and fulfillment</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Change live prices, hide or enable formats, track every user payment record, and move retouch requests from intake through completion without leaving the dashboard.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Pill tone="blue">{overview?.mode === 'full' ? 'Full account view' : 'Transaction-backed view'}</Pill>
                  <Pill tone="slate">Refreshed {formatDateTime(overview?.refreshedAt)}</Pill>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={handleRefresh} className="secondary-button justify-center" disabled={loading}>
                  {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Refresh
                </button>
                <button type="button" onClick={handleLogout} className="secondary-button justify-center">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8 xl:grid-cols-5">
            <MetricCard icon={<Users className="h-5 w-5" />} label="Accounts" value={metrics.accountCount} copy="Unique customer records visible to the admin workspace." />
            <MetricCard icon={<ReceiptText className="h-5 w-5" />} label="Transactions" value={metrics.transactionCount} copy={`${metrics.paidTransactionCount} paid and ${metrics.pendingTransactionCount} pending.`} />
            <MetricCard icon={<Wallet className="h-5 w-5" />} label="Revenue" value={formatCurrency(metrics.revenue)} copy="Completed order value tracked by the dashboard." />
            <MetricCard icon={<Sparkles className="h-5 w-5" />} label="Open queue" value={metrics.queuedReviewCount} copy={`${metrics.inProgressReviewCount} currently in progress.`} />
            <MetricCard icon={<Settings2 className="h-5 w-5" />} label="Live formats" value={metrics.activeDocumentCount} copy="Document types currently visible on the storefront." />
          </div>
        </section>

        {errorMessage ? (
          <div className="mt-6 rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-700">{errorMessage}</div>
        ) : null}

        <section className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_380px]">
          <div className="surface-card p-6 sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <SectionTitle
                title="Pricing and catalog controls"
                copy="These values feed the live storefront and Stripe checkout. Saving here updates the document list and premium add-on price."
              />
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Updated {formatDateTime(settingsForm.updatedAt)}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-700">Premium retouch fee</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsForm.premiumRetouchFee}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, premiumRetouchFee: Number(event.target.value || 0) }))}
                  className="input-shell"
                />
              </label>
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600">
                The premium add-on appears once per order and is currently set to <span className="font-semibold text-slate-900">{formatCurrency(settingsForm.premiumRetouchFee)}</span>.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <SectionTitle title="Document pricing" copy="Hide formats that should not accept new orders, or change prices without redeploying." />
              <Pill tone="blue">{activeDocumentCount} active</Pill>
            </div>

            <div className="mt-5 space-y-3">
              {settingsForm.documents.map((document) => (
                <DocumentSettingRow
                  key={document.documentId}
                  document={document}
                  disableToggle={document.isActive && activeDocumentCount <= 1}
                  onUpdatePrice={(value) => updateDocumentSetting(document.documentId, { price: Number(value || 0) })}
                  onToggleActive={() => handleToggleDocumentActive(document.documentId)}
                />
              ))}
            </div>

            {settingsState.message ? (
              <div className={`mt-5 rounded-[28px] border px-5 py-4 text-sm leading-6 ${
                settingsState.status === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                {settingsState.message}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleSaveSettings} disabled={settingsState.status === 'loading'} className="primary-button justify-center">
                {settingsState.status === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
                Save live settings
              </button>
            </div>
          </div>

          <div className="surface-card p-6 sm:p-7">
            <SectionTitle title="Queue snapshot" copy="Every premium retouch and manual-review request in the system." />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <DetailMiniCard icon={<Sparkles className="h-4 w-4" />} label="Premium queue" value={metrics.premiumQueueCount} />
              <DetailMiniCard icon={<AlertTriangle className="h-4 w-4" />} label="Manual queue" value={metrics.manualQueueCount} />
              <DetailMiniCard icon={<CheckCircle2 className="h-4 w-4" />} label="In progress" value={metrics.inProgressReviewCount} />
              <DetailMiniCard icon={<CreditCard className="h-4 w-4" />} label="Pending payments" value={metrics.pendingTransactionCount} />
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <div className="surface-card overflow-hidden p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Accounts</div>
                  <div className="mt-1 text-sm text-slate-500">Search customers, order references, or payment references.</div>
                </div>
                <Pill tone="blue">{filteredUsers.length}</Pill>
              </div>
              <div className="mt-5 relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} className="input-shell pl-11" placeholder="Search name, email, phone" />
              </div>
              <div className="mt-5 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {filteredUsers.length ? filteredUsers.map((user) => (
                  <UserListCard key={user.key} user={user} active={selectedUser?.key === user.key} onSelect={() => setSelectedUserKey(user.key)} />
                )) : (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                    <div className="text-sm font-semibold text-slate-900">No matching accounts</div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">Try a different search term to find the customer.</div>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            {!selectedUser ? (
              <EmptyPanel title="No account selected" copy="Choose a customer from the left rail to inspect activity, transaction history, and review requests." />
            ) : (
              <>
                <div className="surface-card p-6 sm:p-7 animate-fade-up">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-blue-50 text-xl font-semibold text-blue-700">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected account</div>
                        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{selectedUser.name}</h2>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Pill tone="slate">{selectedUser.email || 'No email captured'}</Pill>
                          <Pill tone="blue">{titleize(selectedUser.role || 'customer')}</Pill>
                          <Pill tone={selectedUser.source === 'profile' ? 'emerald' : 'amber'}>
                            {selectedUser.source === 'profile' ? 'Verified account record' : 'Transaction-backed account'}
                          </Pill>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 xl:w-[26rem]">
                      <DetailMiniCard icon={<ReceiptText className="h-4 w-4" />} label="Orders" value={selectedUser.orderCount} />
                      <DetailMiniCard icon={<CreditCard className="h-4 w-4" />} label="Transactions" value={selectedUser.transactionCount} />
                      <DetailMiniCard icon={<Wallet className="h-4 w-4" />} label="Spent" value={formatCurrency(selectedUser.totalSpent)} />
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <DetailMiniCard icon={<Mail className="h-4 w-4" />} label="Email" value={selectedUser.email || 'Not captured'} />
                    <DetailMiniCard icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedUser.phone || 'Not captured'} />
                    <DetailMiniCard icon={<Users className="h-4 w-4" />} label="Created" value={formatDate(selectedUser.createdAt) || 'Unknown'} />
                    <DetailMiniCard icon={<CheckCircle2 className="h-4 w-4" />} label="Latest activity" value={formatDateTime(selectedUser.latestActivityAt)} />
                  </div>
                </div>

                <div className="surface-card p-6 sm:p-7 animate-fade-up">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <SectionTitle title="Create review request" copy="Queue new premium retouch or manual-review work for the latest visible order or transaction on this account." />
                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      {activeTarget ? (
                        <>Targeting <span className="font-semibold text-slate-900">{activeTarget.reference || activeTarget.paymentReference || activeTarget.id}</span></>
                      ) : 'No order or transaction available for request actions.'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_220px]">
                    <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} className="input-shell min-h-[7.5rem] rounded-[28px]" placeholder="Add context for the review team or delivery workflow." />
                    <div className="space-y-3">
                      <label className="block">
                        <div className="mb-2 text-sm font-semibold text-slate-700">Priority</div>
                        <select value={reviewPriority} onChange={(event) => setReviewPriority(event.target.value)} className="input-shell">
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>
                      <button type="button" onClick={() => handleCreateReviewRequest('manual_review')} disabled={!activeTarget || actionState.status === 'loading'} className="primary-button w-full justify-center">
                        {actionState.status === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                        Request manual review
                      </button>
                      <button type="button" onClick={() => handleCreateReviewRequest('premium_retouch')} disabled={!activeTarget || actionState.status === 'loading'} className="secondary-button w-full justify-center">
                        <Sparkles className="h-4 w-4" />
                        Queue premium retouch
                      </button>
                    </div>
                  </div>

                  {actionState.message ? (
                    <div className={`mt-5 rounded-[28px] border px-5 py-4 text-sm leading-6 ${
                      actionState.status === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}>
                      {actionState.message}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-6 2xl:grid-cols-[0.92fr_1.08fr]">
                  <div className="surface-card p-6 sm:p-7 animate-fade-up">
                    <SectionTitle title="Order history" copy="Saved paid orders tied to this account." />
                    <div className="mt-5 space-y-4">
                      {selectedOrders.length ? selectedOrders.map((order) => (
                        <article key={order.id} className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{order.id}</div>
                              <div className="mt-1 text-sm text-slate-500">{order.serviceSummary}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone="emerald">{order.status}</Pill>
                              {order.premiumRetouch ? <Pill tone="blue">Premium</Pill> : null}
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div><div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Verified</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(order.paymentVerifiedAt || order.date)}</div></div>
                            <div><div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Total</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(order.total)}</div></div>
                            <div><div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Transaction</div><div className="mt-1 text-sm font-semibold text-slate-900">{order.paymentReference}</div></div>
                          </div>
                        </article>
                      )) : (
                        <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                          <div className="text-sm font-semibold text-slate-900">No saved orders</div>
                          <div className="mt-2 text-sm leading-6 text-slate-500">This account does not have a saved order record yet.</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="surface-card p-6 sm:p-7 animate-fade-up">
                    <SectionTitle title="Transactions" copy="Every visible payment attempt for this account." />
                    <div className="mt-5 space-y-4">
                      {selectedTransactions.length ? selectedTransactions.map((transaction) => (
                        <article key={transaction.reference} className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{transaction.reference}</div>
                              <div className="mt-1 text-sm text-slate-500">{transaction.documentLabel}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={transaction.status === 'success' ? 'emerald' : ['pending', 'ongoing', 'processing', 'queued'].includes(transaction.status) ? 'amber' : 'red'}>
                                {titleize(transaction.status)}
                              </Pill>
                              {transaction.premiumRetouch ? <Pill tone="blue">Premium</Pill> : null}
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div><div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Amount</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(transaction.amount)}</div></div>
                            <div><div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Paid</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(transaction.paidAt || transaction.createdAt)}</div></div>
                            <div><div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Channel</div><div className="mt-1 text-sm font-semibold capitalize text-slate-900">{transaction.channel}</div></div>
                          </div>
                        </article>
                      )) : (
                        <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                          <div className="text-sm font-semibold text-slate-900">No transaction history</div>
                          <div className="mt-2 text-sm leading-6 text-slate-500">A payment record will appear here as soon as the customer reaches checkout.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <div className="surface-card p-5 sm:p-6">
              <SectionTitle title="Review queue" copy="Open, in-progress, and completed requests." />
              <div className="mt-5 flex flex-wrap gap-2">
                <QueueFilterButton label="Open" active={queueFilter === 'open'} onClick={() => setQueueFilter('open')} />
                <QueueFilterButton label="In progress" active={queueFilter === 'in_progress'} onClick={() => setQueueFilter('in_progress')} />
                <QueueFilterButton label="Completed" active={queueFilter === 'completed'} onClick={() => setQueueFilter('completed')} />
                <QueueFilterButton label="All" active={queueFilter === 'all'} onClick={() => setQueueFilter('all')} />
              </div>
              <div className="mt-5 max-h-[46vh] space-y-3 overflow-y-auto pr-1">
                {visibleQueueItems.length ? visibleQueueItems.map((item) => (
                  <QueueCard key={item.id} item={item} active={selectedQueueItem?.id === item.id} onSelect={() => setSelectedQueueId(item.id)} />
                )) : (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                    <div className="text-sm font-semibold text-slate-900">Queue is clear</div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">No requests match the current filter.</div>
                  </div>
                )}
              </div>
            </div>

            {selectedQueueItem ? (
              <div className="surface-card p-5 sm:p-6">
                <SectionTitle title="Fulfillment editor" copy="Update status, assign work, and record the completion note." />
                <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <div><span className="font-semibold text-slate-900">Customer:</span> {selectedQueueItem.customerName}</div>
                  <div className="mt-2"><span className="font-semibold text-slate-900">Reference:</span> {selectedQueueItem.transactionReference}</div>
                  <div className="mt-2"><span className="font-semibold text-slate-900">Created:</span> {formatDateTime(selectedQueueItem.createdAt)}</div>
                  <div className="mt-2"><span className="font-semibold text-slate-900">Completed:</span> {formatDateTime(selectedQueueItem.completedAt)}</div>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">Status</div>
                    <select value={queueEditor.status} onChange={(event) => setQueueEditor((current) => ({ ...current, status: event.target.value }))} className="input-shell">
                      <option value="requested">Requested</option>
                      <option value="queued">Queued</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">Priority</div>
                    <select value={queueEditor.priority} onChange={(event) => setQueueEditor((current) => ({ ...current, priority: event.target.value }))} className="input-shell">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">Assignee</div>
                    <input type="text" value={queueEditor.assignee} onChange={(event) => setQueueEditor((current) => ({ ...current, assignee: event.target.value }))} className="input-shell" placeholder="Initials or team member" />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">Request note</div>
                    <textarea value={queueEditor.note} onChange={(event) => setQueueEditor((current) => ({ ...current, note: event.target.value }))} rows={4} className="input-shell min-h-[7rem] rounded-[28px]" />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">Fulfillment note</div>
                    <textarea value={queueEditor.fulfillmentNote} onChange={(event) => setQueueEditor((current) => ({ ...current, fulfillmentNote: event.target.value }))} rows={5} className="input-shell min-h-[8rem] rounded-[28px]" placeholder="What was corrected and what was delivered." />
                  </label>
                </div>

                {queueState.message ? (
                  <div className={`mt-5 rounded-[28px] border px-5 py-4 text-sm leading-6 ${
                    queueState.status === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}>
                    {queueState.message}
                  </div>
                ) : null}

                <button type="button" onClick={handleSaveQueueRequest} disabled={queueState.status === 'loading'} className="primary-button mt-5 w-full justify-center">
                  {queueState.status === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save fulfillment update
                </button>
              </div>
            ) : (
              <EmptyPanel title="No queue item selected" copy="Choose a queue entry to update assignee, status, and completion notes." />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
