import { Download } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils/formatters';
import { FlagMark } from '../shared/FlagMark';

function StatusBadge({ value }) {
  const normalizedValue = String(value || '').toLowerCase();
  const tone =
    normalizedValue.includes('premium')
      ? 'bg-amber-50 text-amber-700'
      : 'bg-emerald-50 text-emerald-700';

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {value}
    </span>
  );
}

export function OrdersTable({ orders, onDownload }) {
  if (!orders.length) {
    return (
      <div className="surface-card px-6 py-14 text-center">
        <div className="text-lg font-semibold text-slate-900">No orders yet</div>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
          Complete a photo flow and the order history will appear here with download links and
          premium-review flags.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] lg:block">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-6 py-4 font-semibold">Order</th>
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Premium</th>
              <th className="px-6 py-4 font-semibold">Total</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50/80">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    {order.items[0]?.flagPath ? (
                      <FlagMark src={order.items[0].flagPath} label={order.items[0].countryLabel} size="sm" />
                    ) : null}
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{order.id}</div>
                      <div className="mt-1 text-sm text-slate-500">{order.serviceSummary}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-sm text-slate-600">{formatDate(order.date)}</td>
                <td className="px-6 py-5 text-sm text-slate-600">
                  {order.premiumRetouch ? 'Selected' : 'Not selected'}
                </td>
                <td className="px-6 py-5 text-sm font-semibold text-slate-900">
                  {formatCurrency(order.total)}
                </td>
                <td className="px-6 py-5">
                  <StatusBadge value={order.status} />
                </td>
                <td className="px-6 py-5 text-right">
                  <button
                    type="button"
                    onClick={() => onDownload(order.items[0], order.id)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:hidden">
        {orders.map((order) => (
          <article key={order.id} className="surface-card p-5 animate-fade-up">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  {order.items[0]?.flagPath ? (
                    <FlagMark src={order.items[0].flagPath} label={order.items[0].countryLabel} size="sm" />
                  ) : null}
                  <div className="text-sm font-semibold text-slate-900">{order.id}</div>
                </div>
                <div className="mt-1 text-sm text-slate-500">{order.serviceSummary}</div>
              </div>
              <StatusBadge value={order.status} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDate(order.date)}</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Premium</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {order.premiumRetouch ? 'Selected' : 'Not selected'}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(order.total)}</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:col-span-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Transaction ID
                </div>
                <div className="mt-2 truncate text-sm font-semibold text-slate-900">
                  {order.paymentReference || order.id}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDownload(order.items[0], order.id)}
              className="secondary-button mt-5 justify-center"
            >
              <Download className="h-4 w-4" />
              Download JPG
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
