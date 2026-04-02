import { LayoutDashboard } from 'lucide-react';
import { formatCurrency } from '../../lib/utils/formatters';
import { OrdersTable } from './OrdersTable';

export function DashboardView({ user, orders, onDownload }) {
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
                  {user?.name?.charAt(0) || 'D'}
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.22em] text-blue-200">Orders dashboard</div>
                  <h1 className="mt-2 text-3xl font-semibold">{user?.name || 'Demo User'}</h1>
                  <p className="mt-1 text-sm text-slate-300">{user?.email || 'demo@example.com'}</p>
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

          <div className="px-6 py-8 sm:px-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">Recent orders</div>
                <div className="text-sm text-slate-500">Stored locally for this MVP session.</div>
              </div>
            </div>

            <OrdersTable orders={orders} onDownload={onDownload} />
          </div>
        </div>
      </div>
    </div>
  );
}
