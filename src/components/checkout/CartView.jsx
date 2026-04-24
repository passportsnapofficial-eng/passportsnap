import { ShoppingCart, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils/formatters';
import { FlagMark } from '../shared/FlagMark';
import { ProtectedPhotoPreview } from '../shared/ProtectedPhotoPreview';
import { CartSummary } from './CartSummary';
import { PremiumRetouchUpsell } from './PremiumRetouchUpsell';

export function CartView({
  cart,
  totals,
  premiumRetouch,
  premiumRetouchFee = 0,
  premiumRetouchRequired = false,
  onTogglePremium,
  onRemoveItem,
  onContinueShopping,
  onProceedToCheckout,
}) {
  if (!cart.length) {
    return (
      <div className="page-shell py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="surface-card px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-slate-900">Your cart is empty</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600">
              Start a guided photo flow for any supported country format, review the automated
              result, and it will appear here for checkout.
            </p>
            <button type="button" onClick={onContinueShopping} className="primary-button mt-8">
              Start Photo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Cart</span>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Review your order before checkout.</h1>
          </div>
          <button type="button" onClick={onContinueShopping} className="secondary-button">
            Start Photo
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-5">
            {cart.map((item, index) => (
              <article key={item.id} className="surface-card p-5 sm:p-6 animate-fade-up">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="w-full max-w-[180px] rounded-[28px] bg-slate-100 p-3">
                    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
                      <ProtectedPhotoPreview
                        src={item.photo}
                        alt={item.documentName}
                        watermarkEnabled={Boolean(item.backgroundRemovalApplied)}
                        className="bg-white p-3"
                        imageClassName="rounded-[18px]"
                        aspectRatio={`${item.outputWidth || 4} / ${item.outputHeight || 5}`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-3">
                            {item.flagPath ? (
                              <FlagMark src={item.flagPath} label={item.countryLabel} size="md" />
                            ) : null}
                            <h2 className="text-xl font-semibold text-slate-900">{item.documentName}</h2>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{item.outputLabel}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-slate-900">
                            {formatCurrency(item.basePrice)}
                          </div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Base export
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Country
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{item.countryLabel}</div>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Size
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{item.sizeLabel}</div>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Initial check
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{item.statusLabel}</div>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:col-span-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Premium add-on
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">
                            {item.requiresPremiumRetouch
                              ? 'Required for this photo'
                              : premiumRetouch
                                ? 'Selected'
                                : 'Not selected'}
                          </div>
                          {item.premiumRetouchReason ? (
                            <div className="mt-2 text-sm leading-6 text-slate-500">{item.premiumRetouchReason}</div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(index)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-red-600 transition hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                      <div className="text-sm text-slate-500">
                        Downloadable output is attached to the final order.
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            <PremiumRetouchUpsell enabled={premiumRetouch} fee={premiumRetouchFee} required={premiumRetouchRequired} onToggle={onTogglePremium} />
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <CartSummary
              itemCount={cart.length}
              subtotal={totals.subtotal}
              premiumFee={totals.premiumFee}
              total={totals.total}
              ctaLabel="Checkout"
              onCta={onProceedToCheckout}
              footerNote={
                premiumRetouchRequired
                  ? 'Premium retouch is required for this order because at least one photo needs manual background cleanup.'
                  : 'Premium retouch applies once per order and is saved into the order history.'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
