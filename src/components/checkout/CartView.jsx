import { useState } from 'react';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils/formatters';
import { FlagMark } from '../shared/FlagMark';
import { ProtectedPhotoPreview } from '../shared/ProtectedPhotoPreview';
import { CartSummary } from './CartSummary';

export function CartView({
  cart,
  totals,
  premiumRetouchRequired = false,
  onRemoveItem,
  onContinueShopping,
  onProceedToCheckout,
}) {
  const [showAllItems, setShowAllItems] = useState(false);

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

  const visibleItems = showAllItems ? cart : cart.slice(0, 6);
  const hasMoreItems = cart.length > 6;

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Cart</span>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Review your order before checkout.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Your selected photos are shown below. Package and add-on choices now happen during checkout.
            </p>
          </div>
          <button type="button" onClick={onContinueShopping} className="secondary-button">
            Start Photo
          </button>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_21rem]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item, index) => {
                const cartIndex = cart.findIndex((cartItem) => cartItem.id === item.id);
                return (
                  <article key={item.id} className="surface-card flex h-full flex-col p-4 animate-fade-up">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {item.flagPath ? (
                          <FlagMark src={item.flagPath} label={item.countryLabel} size="sm" />
                        ) : null}
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold text-slate-900">{item.documentName}</h2>
                          <p className="mt-0.5 text-sm text-slate-500">{item.sizeLabel}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(cartIndex)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${item.documentName} from cart`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 rounded-[24px] bg-slate-100 p-3">
                      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                        <ProtectedPhotoPreview
                          src={item.photo}
                          alt={item.documentName}
                          watermarkEnabled={Boolean(item.backgroundRemovalApplied)}
                          className="bg-white p-3"
                          imageClassName="rounded-[14px]"
                          aspectRatio={`${item.outputWidth || 4} / ${item.outputHeight || 5}`}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900">{item.outputLabel}</div>
                            <div className="mt-1 text-sm text-slate-500">{item.countryLabel}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-base font-semibold text-slate-900">{formatCurrency(item.basePrice)}</div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Base export</div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Initial check
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{item.statusLabel}</div>
                          </div>
                          {item.requiresPremiumRetouch ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                                Note
                              </div>
                              <div className="mt-1 text-sm font-medium text-amber-900">
                                Premium retouch required for this photo
                              </div>
                              {item.premiumRetouchReason ? (
                                <div className="mt-1 text-sm leading-5 text-amber-800">{item.premiumRetouchReason}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-sm text-slate-500">Downloadable output is attached to the final order.</div>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasMoreItems ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllItems((current) => !current)}
                  className="secondary-button"
                >
                  {showAllItems ? 'Show less' : `Show more (${cart.length - 6} more)`}
                </button>
              </div>
            ) : null}
          </div>

          <div className="xl:sticky xl:top-28 xl:self-start">
            <CartSummary
              itemCount={cart.length}
              subtotal={totals.subtotal}
              photoPackage={totals.photoPackage}
              printCopies={totals.printCopies}
              printPackageFee={totals.printPackageFee}
              complianceCheck={totals.complianceCheck}
              complianceCheckFee={totals.complianceCheckFee}
              photoRetouching={totals.photoRetouching}
              photoRetouchingFee={totals.photoRetouchingFee}
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
