import { CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils/formatters';

export function PremiumRetouchUpsell({ enabled, required = false, fee = 0, onToggle }) {
  const active = enabled || required;

  return (
    <button
      type="button"
      onClick={required ? undefined : onToggle}
      disabled={required}
      className={`w-full rounded-[28px] border p-5 text-left transition duration-300 ${
        active
          ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100 shadow-[0_22px_48px_-30px_rgba(59,130,246,0.45)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border ${
            active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'
          }`}
        >
          <CheckCircle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-slate-900">Premium retouch / background cleanup</div>
                {required ? (
                  <span className="rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                    Required
                  </span>
                ) : enabled ? (
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                    Selected
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {required
                  ? 'This order needs manual background cleanup before final delivery, so the add-on stays enabled.'
                  : 'For customers who want additional fine-tuning, white-background cleanup, or manual review before final delivery.'}
              </p>
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
              +{formatCurrency(fee)}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
