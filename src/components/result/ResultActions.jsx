import { ArrowRight, RefreshCcw } from 'lucide-react';

export function ResultActions({
  canProceed,
  requiresPremiumRetouch = false,
  onProceedToCheckout,
  onRetake,
}) {
  const ctaLabel = requiresPremiumRetouch ? 'Checkout with background cleanup' : 'Checkout';

  return (
    <div className="surface-card p-6 sm:p-7">
      <div className="text-sm font-semibold text-slate-900">Next step</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Move forward when the review looks right, or go back and retake the source image.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onProceedToCheckout}
          disabled={!canProceed}
          className="primary-button w-full justify-between"
        >
          <span>{ctaLabel}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onRetake} className="secondary-button w-full justify-center">
          <RefreshCcw className="h-4 w-4" />
          Retake
        </button>
      </div>

      {canProceed && requiresPremiumRetouch ? (
        <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This photo can continue only if premium retouch and background cleanup stay enabled at checkout.
        </p>
      ) : null}

      {!canProceed ? (
        <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Checkout stays disabled until the first-pass review is clear enough to proceed.
        </p>
      ) : null}
    </div>
  );
}
