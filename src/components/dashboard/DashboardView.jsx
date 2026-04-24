import { LayoutDashboard, LoaderCircle, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../lib/utils/formatters';
import { OrdersTable } from './OrdersTable';
import { ProfileCard } from './ProfileCard';

function DashboardNotice({ state }) {
  if (!state?.message || state.status === 'idle') return null;

  const toneClasses =
    state.status === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : state.status === 'loading'
        ? 'border-blue-200 bg-blue-50 text-blue-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className={`rounded-[28px] border px-5 py-4 text-sm leading-6 ${toneClasses}`}>
      {state.message}
    </div>
  );
}

export function DashboardView({
  authConfigured,
  authLoading,
  user,
  orders,
  ordersLoading,
  dashboardState,
  profileState,
  onDownload,
  onOpenAuth,
  onProfileSave,
}) {
  if (!authConfigured) {
    return (
      <div className="page-shell py-10 sm:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="surface-card overflow-hidden">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white sm:px-8">
              <div className="text-sm uppercase tracking-[0.22em] text-blue-200">Orders dashboard</div>
              <h1 className="mt-2 text-3xl font-semibold">Account access unavailable</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Account creation, sign in, and saved order history are temporarily unavailable
                right now.
              </p>
            </div>

            <div className="px-6 py-8 sm:px-8">
              <div className="rounded-[30px] border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-900">
                Saved account features are not ready yet. You can still use the photo flow and
                continue as a local session.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="page-shell py-10 sm:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="surface-card px-6 py-14 text-center sm:px-8">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <div className="mt-5 text-lg font-semibold text-slate-900">Loading account</div>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              Restoring your session and loading the dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-shell py-10 sm:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="surface-card overflow-hidden">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white sm:px-8">
              <div className="text-sm uppercase tracking-[0.22em] text-blue-200">Orders dashboard</div>
              <h1 className="mt-2 text-3xl font-semibold">Sign in to open your dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Orders, downloads, and saved profile details are stored in your account so they are
                available across devices.
              </p>
            </div>

            <div className="px-6 py-8 sm:px-8">
              <div className="rounded-[30px] border border-blue-200 bg-blue-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Account access required</div>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                      Create an account or sign in to see your saved orders on any device.
                    </p>
                    <button type="button" onClick={onOpenAuth} className="primary-button mt-5">
                      Create account or sign in
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const premiumCount = orders.filter((order) => order.premiumRetouch).length;

  return (
    <div className="page-shell py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-white/10 text-2xl font-semibold">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.22em] text-blue-200">Orders dashboard</div>
                  <h1 className="mt-2 text-3xl font-semibold">{user?.name}</h1>
                  <p className="mt-1 text-sm text-slate-300">{user?.email}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Orders</div>
                  <div className="mt-2 text-2xl font-semibold">{orders.length}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Premium review</div>
                  <div className="mt-2 text-2xl font-semibold">{premiumCount}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Total paid</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrency(totalRevenue)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-8 sm:px-8 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <ProfileCard
                user={user}
                saving={profileState?.status === 'saving'}
                statusMessage={profileState?.status === 'success' ? profileState.message : ''}
                errorMessage={profileState?.status === 'error' ? profileState.message : ''}
                onSubmit={onProfileSave}
              />
              <DashboardNotice state={dashboardState} />
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div>
                <div className="text-lg font-semibold text-slate-900">Saved orders</div>
                <div className="text-sm text-slate-500">
                  Paid orders and downloads saved to your account.
                </div>
              </div>
              </div>

              {ordersLoading ? (
                <div className="surface-card px-6 py-14 text-center">
                  <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                  <div className="mt-4 text-sm font-semibold text-slate-900">Loading orders</div>
                  <div className="mt-2 text-sm text-slate-500">
                    Pulling your latest dashboard history.
                  </div>
                </div>
              ) : (
                <OrdersTable orders={orders} onDownload={onDownload} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
