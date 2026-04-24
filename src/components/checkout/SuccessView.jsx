import { CheckCircle2, Download, LayoutDashboard } from 'lucide-react';
import { VIEWS } from '../../lib/utils/constants';
import { formatCurrency, formatDate } from '../../lib/utils/formatters';
import { FlowShell } from '../flow/FlowShell';
import { FlagMark } from '../shared/FlagMark';
import { ProtectedPhotoPreview } from '../shared/ProtectedPhotoPreview';

export function SuccessView({ order, onDownload, onBackHome, onOpenDashboard }) {
  if (!order) {
    return (
      <FlowShell
        currentView={VIEWS.success}
        title="Order not found"
        description="There is no completed order in memory right now."
        onBack={onBackHome}
        backLabel="Back to home"
        chip="Step 7 of 7"
        compactHeader
        summaryItems={[
          { label: 'Order', value: 'Not available' },
          { label: 'Status', value: 'No completed order' },
        ]}
      >
        <div className="surface-card px-6 py-14 text-center">
          <button type="button" onClick={onBackHome} className="primary-button">
            Back to home
          </button>
        </div>
      </FlowShell>
    );
  }

  const primaryItem = order.items[0] || null;

  return (
    <FlowShell
      currentView={VIEWS.success}
      title="Order confirmed and ready to download"
      description="The export has been attached to the order, saved to the account dashboard, and is ready for immediate download."
      onBack={onBackHome}
      backLabel="Back to home"
      chip="Step 7 of 7"
      compactHeader
      summaryItems={[
        { label: 'Order', value: order.id },
        { label: 'Items', value: `${order.items.length}` },
        { label: 'Total', value: formatCurrency(order.total) },
        { label: 'Status', value: 'Ready to download' },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <div className="space-y-5">
          <div className="surface-card overflow-hidden p-6 sm:p-7 animate-fade-up">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[24px] bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">Order complete</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {order.premiumRetouch
                    ? 'Premium retouch was included with this order.'
                    : 'The standard automated export is ready now.'}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Order ID
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{order.id}</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Transaction ID
                </div>
                <div className="mt-2 break-all text-sm font-semibold leading-6 text-slate-900">
                  {order.paymentReference || order.id}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Ordered on
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDate(order.date)}</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Total paid
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(order.total)}</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Payment method
                </div>
                <div className="mt-2 text-sm font-semibold capitalize text-slate-900">
                  {order.paymentChannel || 'Online payment'}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onBackHome} className="primary-button justify-center">
                Start Photo
              </button>
              <button type="button" onClick={onOpenDashboard} className="secondary-button justify-center">
                <LayoutDashboard className="h-4 w-4" />
                Open dashboard
              </button>
            </div>

            {primaryItem?.photo ? (
              <div className="mt-6 rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Processed image
                </div>
                <div className="mt-3 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3">
                  <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                    <ProtectedPhotoPreview
                      src={primaryItem.photo}
                      alt={`${primaryItem.documentName} processed export`}
                      watermarkEnabled={Boolean(primaryItem.backgroundRemovalApplied)}
                      className="bg-white"
                      aspectRatio={`${primaryItem.outputWidth || 600} / ${primaryItem.outputHeight || 600}`}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 animate-slide-up">
          {order.items.map((item, index) => (
            <article key={item.id || index} className="surface-card p-5 sm:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                {item.photo ? (
                  <div className="w-full md:max-w-[15rem] md:flex-[0_0_15rem]">
                    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-3">
                      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                        <ProtectedPhotoPreview
                          src={item.photo}
                          alt={`${item.documentName} processed export`}
                          watermarkEnabled={Boolean(item.backgroundRemovalApplied)}
                          className="bg-white"
                          aspectRatio={`${item.outputWidth || 600} / ${item.outputHeight || 600}`}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        {item.flagPath ? (
                          <FlagMark src={item.flagPath} label={item.countryLabel} size="sm" />
                        ) : null}
                        <div className="text-sm font-semibold text-slate-900">{item.documentName}</div>
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        {item.countryLabel} - {item.sizeLabel} - {item.outputLabel}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        Premium add-on: {item.premiumRetouch ? 'Selected' : 'Not selected'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDownload(item, order.id)}
                      className="secondary-button justify-center"
                    >
                      <Download className="h-4 w-4" />
                      Download JPG
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </FlowShell>
  );
}
