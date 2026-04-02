import { AlertCircle, ArrowRight, CheckCircle2, CreditCard, LoaderCircle, ShieldCheck } from 'lucide-react';
import { VIEWS } from '../../lib/utils/constants';
import { FlowShell } from '../flow/FlowShell';
import { FlagMark } from '../shared/FlagMark';
import { CartSummary } from './CartSummary';
import { PremiumRetouchUpsell } from './PremiumRetouchUpsell';

export function CheckoutView({
  cart,
  user,
  totals,
  premiumRetouch,
  onTogglePremium,
  paymentState,
  onBack,
  onSubmit,
  loading,
}) {
  const primaryItem = cart[0];
  const isVerifying = paymentState?.status === 'verifying';
  const isSuccess = paymentState?.status === 'success';
  const isError = paymentState?.status === 'error';
  const submitLabel = isVerifying
    ? 'Verifying payment...'
    : loading
      ? 'Redirecting to Paystack...'
      : 'Continue to Paystack';

  return (
    <FlowShell
      currentView={VIEWS.checkout}
      title="Checkout and finalize the order"
      description="Review the export, add premium retouch if needed, then complete the secure Paystack payment to unlock downloads."
      onBack={onBack}
      backLabel="Back to result"
      chip="Step 5 of 6"
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
                The final amount is sent to Paystack and the order is created only after payment
                verification succeeds.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6">
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
                  defaultValue={user?.name?.split(' ')?.[0] || 'Demo'}
                  required
                  className="input-shell"
                  placeholder="First name"
                />
                <input
                  type="text"
                  name="lastName"
                  defaultValue={user?.name?.split(' ')?.slice(1).join(' ') || 'Customer'}
                  required
                  className="input-shell"
                  placeholder="Last name"
                />
              </div>
              <input
                type="email"
                name="email"
                defaultValue={user?.email || 'customer@example.com'}
                required
                className="input-shell"
                placeholder="Email address"
              />
              <input
                type="text"
                name="phone"
                defaultValue=""
                className="input-shell"
                placeholder="Phone number"
              />
            </section>

            <section className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Payment</div>
                <p className="mt-1 text-sm text-slate-500">
                  You will be redirected to Paystack to complete the payment on a secure checkout
                  page that works across desktop and mobile browsers.
                </p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="space-y-3 text-sm leading-6 text-slate-600">
                    <p>
                      Paystack will charge the exact final total shown in this summary, including
                      the premium retouch add-on if selected.
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
              <PremiumRetouchUpsell enabled={premiumRetouch} onToggle={onTogglePremium} />
            </section>

            <button
              type="submit"
              disabled={loading || isVerifying || !cart.length}
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
                  <div
                    className="bg-white"
                    style={{ aspectRatio: `${primaryItem.outputWidth || 1} / ${primaryItem.outputHeight || 1}` }}
                  >
                    <img
                      src={primaryItem.photo}
                      alt={primaryItem.documentName}
                      className="h-full w-full rounded-[18px] object-contain"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <CartSummary
            itemCount={cart.length}
            subtotal={totals.subtotal}
            premiumFee={totals.premiumFee}
            total={totals.total}
            footerNote="Downloads unlock after Paystack confirms the payment and the order is verified."
          />
        </div>
      </div>
    </FlowShell>
  );
}
