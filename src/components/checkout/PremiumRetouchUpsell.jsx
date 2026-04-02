import { CheckCircle } from 'lucide-react';
import { PREMIUM_RETOUCH_FEE } from '../../lib/utils/constants';
import { formatCurrency } from '../../lib/utils/formatters';

export function PremiumRetouchUpsell({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-[28px] border p-5 text-left transition ${
        enabled
          ? 'border-blue-200 bg-blue-50 shadow-sm shadow-blue-100/60'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border ${
            enabled ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'
          }`}
        >
          <CheckCircle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Premium retouch / manual review</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                For customers who want additional fine-tuning or manual review before final delivery.
              </p>
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
              +{formatCurrency(PREMIUM_RETOUCH_FEE)}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
