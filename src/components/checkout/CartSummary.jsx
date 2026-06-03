import { formatCurrency } from '../../lib/utils/formatters';
import { getPhotoPackageLabel } from '../../lib/checkout/pricing';

export function CartSummary({
  itemCount,
  subtotal,
  photoPackage,
  printCopies = 2,
  printPackageFee,
  complianceCheck,
  complianceCheckFee,
  photoRetouching,
  photoRetouchingFee,
  premiumFee,
  total,
  ctaLabel,
  onCta,
  ctaDisabled,
  footerNote,
  compact = false,
}) {
  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Order summary</div>
          <div className="mt-1 text-sm text-slate-500">
            {itemCount} {itemCount === 1 ? 'photo' : 'photos'}
          </div>
        </div>
      </div>

      <div className={`mt-5 ${compact ? 'space-y-2' : 'space-y-2.5'}`}>
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          <span>Subtotal</span>
          <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          <span>Photo option</span>
          <span className="font-semibold text-slate-900">
            {getPhotoPackageLabel(photoPackage, printCopies)}
          </span>
        </div>
        {printPackageFee ? (
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
            <span>Printouts & delivery</span>
            <span className="font-semibold text-slate-900">{formatCurrency(printPackageFee)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          <span>Expert compliance check</span>
          <span className="font-semibold text-slate-900">{complianceCheck ? formatCurrency(complianceCheckFee) : 'Not added'}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          <span>Photo retouching</span>
          <span className="font-semibold text-slate-900">{photoRetouching ? formatCurrency(photoRetouchingFee) : 'Not added'}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          <span>Premium retouch / cleanup</span>
          <span className="font-semibold text-slate-900">{premiumFee ? formatCurrency(premiumFee) : 'Not added'}</span>
        </div>
        <div className={`rounded-[24px] border border-slate-200 bg-white px-4 ${compact ? 'py-3' : 'py-3.5'} shadow-[0_18px_42px_-34px_rgba(15,23,42,0.24)]`}>
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
        <p className="mt-3 text-sm leading-5 text-slate-500">{footerNote}</p>
      ) : null}
    </div>
  );
}
