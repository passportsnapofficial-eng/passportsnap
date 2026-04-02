import { formatCurrency } from '../../lib/utils/formatters';

export function CartSummary({
  itemCount,
  subtotal,
  premiumFee,
  total,
  ctaLabel,
  onCta,
  ctaDisabled,
  footerNote,
}) {
  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Order summary</div>
          <div className="mt-1 text-sm text-slate-500">
            {itemCount} {itemCount === 1 ? 'photo' : 'photos'}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Premium retouch</span>
          <span>{premiumFee ? formatCurrency(premiumFee) : 'Not added'}</span>
        </div>
        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {onCta ? (
        <button
          type="button"
          onClick={onCta}
          disabled={ctaDisabled}
          className="primary-button mt-6 w-full justify-center"
        >
          {ctaLabel}
        </button>
      ) : null}

      {footerNote ? (
        <p className="mt-4 text-sm leading-6 text-slate-500">{footerNote}</p>
      ) : null}
    </div>
  );
}
