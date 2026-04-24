import { AlertCircle, ArrowRight, CheckCircle2, CreditCard, LoaderCircle, RefreshCcw, ShieldCheck } from 'lucide-react';
import { VIEWS } from '../../lib/utils/constants';
import { formatCurrency } from '../../lib/utils/formatters';
import { FlowShell } from '../flow/FlowShell';
import { FlagMark } from '../shared/FlagMark';
import { ProtectedPhotoPreview } from '../shared/ProtectedPhotoPreview';
import { CartSummary } from './CartSummary';
import { PremiumRetouchUpsell } from './PremiumRetouchUpsell';

export function CheckoutView({
  cart,
  user,
  authConfigured,
  authLoading,
  totals,
  premiumRetouch,
  premiumRetouchFee = 0,
  premiumRetouchRequired = false,
  onTogglePremium,
  paymentState,
  canRetryVerification,
  onRetryVerification,
  onOpenAuth,
  onBack,
  backLabel = 'Back',
  onSubmit,
  loading,
}) {
  const primaryItem = cart[0];
  const isVerifying = paymentState?.status === 'verifying';
  const isSuccess = paymentState?.status === 'success';
  const isError = paymentState?.status === 'error';
  const requiresAuth = authConfigured && !authLoading && !user;
  const submitLabel = isVerifying
    ? 'Verifying payment...'
    : loading
      ? 'Redirecting...'
      : 'Continue to payment';

  return (
    <FlowShell
      currentView={VIEWS.checkout}
      title="Checkout and finalize the order"
      description="Review the export, add premium retouch if needed, then complete secure checkout to unlock downloads."
      onBack={onBack}
      backLabel={backLabel}
      chip="Step 6 of 7"
      compactHeader
      summaryItems={[
        { label: 'Document', value: primaryItem?.countryLabel || 'Order pending' },
        { label: 'Size', value: primaryItem?.sizeLabel || 'Not available' },
        { label: 'Items', value: `${cart.length}` },
        { label: 'Total', value: formatCurrency(totals.total) },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <form onSubmit={onSubmit} className="surface-card p-6 sm:p-7 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Secure checkout</h2>
              <p className="text-sm text-slate-500">
                The order is created only after Stripe confirms the payment.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6">
            {!authConfigured ? (
              <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-4 sm:p-5 text-sm leading-6 text-amber-900">
                Account checkout is unavailable right now. Please try again later.
              </div>
            ) : null}

            {requiresAuth ? (
              <div className="rounded-[28px] border border-blue-200 bg-blue-50 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">
                      Sign in before payment
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Checkout is tied to a real account now so the paid order, downloads, and
                      profile details stay in the dashboard across devices.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="secondary-button mt-4 justify-center"
                    >
                      Sign in to continue
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {isVerifying || isSuccess || isError ? (
              <div
                className={`rounded-[28px] border p-4 sm:p-5 ${
                  isError
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : isSuccess
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-blue-200 bg-blue-50 text-blue-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isVerifying ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="text-sm leading-6">{paymentState.message}</div>
                </div>

                {isError && canRetryVerification ? (
                  <button
                    type="button"
                    onClick={onRetryVerification}
                    className="secondary-button mt-4 justify-center"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Check payment again
                  </button>
                ) : null}
              </div>
            ) : null}

            <section className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Contact info</div>
                <p className="mt-1 text-sm text-slate-500">
                  This information is attached to the verified payment and saved with the order.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  name="firstName"
                  defaultValue={user?.name?.split(' ')?.[0] || ''}
                  required
                  className="input-shell"
                  placeholder="First name"
                />
                <input
                  type="text"
                  name="lastName"
                  defaultValue={user?.name?.split(' ')?.slice(1).join(' ') || ''}
                  required
                  className="input-shell"
                  placeholder="Last name"
                />
              </div>
              <input
                type="email"
                name="email"
                value={user?.email || ''}
                readOnly
                required
                className="input-shell bg-slate-50 text-slate-500"
                placeholder="Email address"
              />
              <input
                type="text"
                name="phone"
                defaultValue={user?.phone || ''}
                className="input-shell"
                placeholder="Phone number"
              />
            </section>

            <section className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Payment</div>
                <p className="mt-1 text-sm text-slate-500">
                  You will be redirected to a secure Stripe-hosted payment page that works across
                  desktop and mobile browsers.
                </p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="space-y-3 text-sm leading-6 text-slate-600">
                    <p>
                      The exact final total shown in this summary will be charged, including the
                      premium retouch add-on if selected.
                    </p>
                    <p>
                      After payment returns to the app, the transaction is verified before the
                      order is marked paid and download buttons are unlocked.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Optional premium add-on</div>
                <p className="mt-1 text-sm text-slate-500">
                  Add manual review if the customer wants one more layer before final delivery.
                </p>
              </div>
              <PremiumRetouchUpsell enabled={premiumRetouch} fee={premiumRetouchFee} required={premiumRetouchRequired} onToggle={onTogglePremium} />
              {premiumRetouchRequired ? (
                <p className="text-sm leading-6 text-slate-500">
                  At least one photo in this order needs paid background cleanup, so the add-on cannot be removed.
                </p>
              ) : null}
              <p className="text-sm leading-6 text-slate-500">
                Official acceptance still depends on the document authority. Some countries reject edited backgrounds or other altered photos.
              </p>
            </section>

            <button
              type="submit"
              disabled={loading || isVerifying || !cart.length || requiresAuth || !authConfigured || authLoading}
              className="primary-button w-full justify-center py-4 text-base"
            >
              {loading || isVerifying ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5" />
              )}
              {submitLabel}
            </button>
          </div>
        </form>

        <div className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="surface-card p-6 sm:p-7 animate-slide-up">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Order summary</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  The reviewed export below reflects the exact document format selected in the flow.
                </p>
              </div>
            </div>

            {primaryItem ? (
              <div className="mt-5 rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  {primaryItem.flagPath ? (
                    <FlagMark src={primaryItem.flagPath} label={primaryItem.countryLabel} size="md" />
                  ) : null}
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{primaryItem.documentName}</div>
                    <div className="text-sm text-slate-500">{primaryItem.sizeLabel}</div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3">
                  <ProtectedPhotoPreview
                    src={primaryItem.photo}
                    alt={primaryItem.documentName}
                    watermarkEnabled={Boolean(primaryItem.backgroundRemovalApplied)}
                    className="bg-white"
                    imageClassName="rounded-[18px]"
                    aspectRatio={`${primaryItem.outputWidth || 1} / ${primaryItem.outputHeight || 1}`}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <CartSummary
            itemCount={cart.length}
            subtotal={totals.subtotal}
            premiumFee={totals.premiumFee}
            total={totals.total}
            footerNote="Downloads unlock after payment is confirmed and the order is verified."
          />
        </div>
      </div>
    </FlowShell>
  );
}
