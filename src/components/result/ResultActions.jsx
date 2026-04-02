import { ArrowRight, RefreshCcw, ShoppingCart } from 'lucide-react';

export function ResultActions({
  canProceed,
  onProceedToCheckout,
  onReviewCart,
  onRetake,
}) {
  return (
    <div className="surface-card p-6 sm:p-7">
      <div className="text-sm font-semibold text-slate-900">Next step</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Move forward to checkout when the review looks right, or retake the source image instantly.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onProceedToCheckout}
          disabled={!canProceed}
          className="primary-button w-full justify-between"
        >
          <span>Proceed to checkout</span>
          <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onRetake} className="secondary-button w-full justify-center">
          <RefreshCcw className="h-4 w-4" />
          Retake photo
        </button>
        <button type="button" onClick={onReviewCart} className="ghost-button w-full justify-center">
          <ShoppingCart className="h-4 w-4" />
          Open cart
        </button>
      </div>

      {!canProceed ? (
        <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Checkout stays disabled until the automated first-pass review is clear enough to proceed.
        </p>
      ) : null}
    </div>
  );
}
