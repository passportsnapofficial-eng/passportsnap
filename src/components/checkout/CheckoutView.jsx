import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Paintbrush2,
  Package2,
  Printer,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  getPrintCopyLabel,
  getPhotoPackageLabel,
  PHOTO_PACKAGE_TYPES,
  PRINT_COPY_OPTIONS,
} from '../../lib/checkout/pricing';
import {
  getUsCitiesByState,
  getUsStateByCode,
  getUsZipsByStateAndCity,
  lookupUsZip,
  resolveUsCity,
  resolveUsCountryName,
  resolveUsState,
  US_DELIVERY_COUNTRY,
  US_STATE_OPTIONS,
} from '../../data/usLocations';
import { VIEWS } from '../../lib/utils/constants';
import { formatCurrency } from '../../lib/utils/formatters';
import { FlowShell } from '../flow/FlowShell';
import { FlagMark } from '../shared/FlagMark';
import { ProtectedPhotoPreview } from '../shared/ProtectedPhotoPreview';
import { CartSummary } from './CartSummary';

const CHECKOUT_STEPS = [
  {
    id: 1,
    label: 'Package',
    description: 'Choose your photo option',
  },
  {
    id: 2,
    label: 'Add-ons',
    description: 'Enhance your order',
  },
  {
    id: 3,
    label: 'Details & payment',
    description: 'Secure checkout',
  },
];

const STORE_CHIPS = [
  { name: 'CVS', src: '/CVS.webp', imageClassName: 'h-4 sm:h-5' },
  { name: 'Walgreens', src: '/Walgreens.png', imageClassName: 'h-4 sm:h-5' },
  { name: 'Walmart', src: '/Walmart-Logo.png', imageClassName: 'h-4 sm:h-5' },
  { name: 'FedEx', src: '/fedex.png', imageClassName: 'h-4 sm:h-5' },
];

function SectionIntro({ icon, title, copy, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>
        {icon}
      </div>
      <div>
        <h2 className="text-[1.25rem] font-semibold tracking-tight text-slate-950 sm:text-[1.4rem]">
          {title}
        </h2>
        <p className="mt-0.5 max-w-2xl text-sm leading-5 text-slate-500">
          {copy}
        </p>
      </div>
    </div>
  );
}

function TopStepper({ currentStep }) {
  return (
    <div className="hidden md:block">
      <div className="rounded-[24px] border border-slate-200 bg-white/92 p-3 shadow-[0_18px_42px_-38px_rgba(15,23,42,0.22)] backdrop-blur-sm">
        <div className="grid gap-2 md:grid-cols-3">
          {CHECKOUT_STEPS.map((step) => {
            const complete = currentStep > step.id;
            const active = currentStep === step.id;

            return (
              <div
                key={step.id}
                className={`rounded-[18px] border px-3 py-3 ${
                  complete
                    ? 'border-emerald-200 bg-emerald-50/80'
                    : active
                      ? 'border-blue-200 bg-blue-50/90'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                      complete
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : active
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {complete ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <div className="min-w-0 pt-0.5 pr-1">
                    <div className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-slate-900'}`}>
                      {step.label}
                    </div>
                    <div className="mt-0.5 text-xs leading-5 text-slate-500">{step.description}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileStepper({ currentStep }) {
  return (
    <div className="xl:hidden">
      <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_48px_-38px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-slate-500">Step {currentStep}/3</span>
          <span className="font-semibold text-slate-900">
            {CHECKOUT_STEPS.find((step) => step.id === currentStep)?.label}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          {CHECKOUT_STEPS.map((step) => (
            <div
              key={step.id}
              className={`h-2 flex-1 rounded-full ${
                currentStep >= step.id ? 'bg-blue-600' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SelectedPhotoStrip({ item, total, showTotal = true }) {
  if (!item) return null;

  return (
    <div className="rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,1))] px-3 py-3 shadow-[0_16px_42px_-40px_rgba(15,23,42,0.22)]">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex flex-1 items-center gap-2.5">
          {item.flagPath ? <FlagMark src={item.flagPath} label={item.countryLabel} size="sm" /> : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-slate-950">{item.documentName}</div>
            <div className="mt-0.5 text-sm text-slate-500">{item.sizeLabel}</div>
          </div>
        </div>

        {showTotal ? (
          <div className="hidden shrink-0 text-right sm:block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total</div>
            <div className="mt-0.5 text-base font-semibold text-slate-950">{formatCurrency(total)}</div>
          </div>
        ) : null}

        <div className="h-[88px] w-[70px] shrink-0 overflow-hidden rounded-[20px] border border-white/90 bg-white p-1.5 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.46)]">
          <ProtectedPhotoPreview
            src={item.photo}
            alt={item.documentName}
            watermarkEnabled={Boolean(item.backgroundRemovalApplied)}
            className="h-full rounded-[16px] bg-white"
            imageClassName="rounded-[16px]"
            aspectRatio={`${item.outputWidth || 1} / ${item.outputHeight || 1}`}
          />
        </div>
      </div>
    </div>
  );
}

function PackageCard({
  active,
  title,
  feeLabel,
  details,
  helper,
  icon,
  onClick,
  extra,
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <button
        type="button"
        onClick={onClick}
        className={`flex h-full w-full self-start rounded-[22px] border px-4 py-3 text-left transition ${
          active
            ? 'border-blue-500 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(255,255,255,1))] shadow-[0_22px_48px_-34px_rgba(37,99,235,0.34)]'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                active
                  ? 'border-blue-200 bg-white text-blue-600'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              {active ? <Check className="h-4 w-4" /> : icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[1.02rem] font-semibold leading-6 text-slate-950">{title}</div>
                {active ? (
                  <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                    Selected
                  </span>
                ) : null}
              </div>
              <div className="mt-2 space-y-2">
                {details.map((detail) => (
                  <div key={detail} className="flex items-start gap-2 text-sm leading-5 text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
              {helper ? (
                <div className="mt-1.5 text-xs leading-5 text-slate-500">
                  {helper}
                </div>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 self-start rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-950 shadow-sm">
            {feeLabel}
          </div>
        </div>
      </button>
      {extra ? <div>{extra}</div> : null}
    </div>
  );
}

function StoreSupportGrid() {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
      {STORE_CHIPS.map((store) => (
        <div
          key={store.name}
          className="flex h-11 min-w-[72px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)] sm:h-12 sm:min-w-[84px]"
        >
          <img
            src={store.src}
            alt={`${store.name} logo`}
            className={`${store.imageClassName} w-auto max-w-full object-contain`}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

function PrintCopySelector({ value, onChange, printCopyFees }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Choose number of printouts
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {PRINT_COPY_OPTIONS.map((copies) => {
          const active = Number(value) === copies;
          const fee = Number(printCopyFees?.[`digitalPrint${copies}CopyFee`] || 0);
          return (
            <button
              key={copies}
              type="button"
              onClick={() => onChange(copies)}
              className={`rounded-[18px] border px-2 py-2 text-center transition ${
                active
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="text-sm font-semibold">{getPrintCopyLabel(copies)}</div>
              <div className="mt-1 text-xs">{formatCurrency(fee)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddOnCard({
  active,
  title,
  priceLabel,
  description,
  icon,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full w-full rounded-[24px] border px-4 py-3.5 text-left transition ${
        active
          ? 'border-blue-500 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(255,255,255,1))] shadow-[0_24px_56px_-38px_rgba(37,99,235,0.34)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
              active
                ? 'border-blue-200 bg-white text-blue-600'
                : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}
          >
            {active ? <Check className="h-4 w-4" /> : icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-semibold text-slate-950">{title}</div>
              {active ? (
                <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                  Selected
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">{description}</p>
          </div>
        </div>
        <div className="shrink-0 text-sm font-semibold text-slate-950">{priceLabel}</div>
      </div>
    </button>
  );
}

function ReviewChecklist() {
  const items = [
    'Head size and eye line',
    'Crop and centering',
    'Background and shadows',
    'Expression and glasses',
    'Lighting consistency',
  ];

  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3.5">
      <div className="text-sm font-semibold text-slate-950">What expert review checks</div>
      <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentHelperBox({ helperPoints }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-950">What happens next</div>
          <div className="mt-1.5 space-y-1.5">
            {helperPoints.map((point) => (
              <p key={point} className="text-sm leading-6 text-slate-600">
                {point}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SafetyBadges() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        '100% money-back guarantee',
        'Image info protected',
        'Secure Stripe checkout',
      ].map((badge) => (
        <div key={badge} className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>{badge}</span>
        </div>
      ))}
    </div>
  );
}

function TrustNotice({ requiresPhysicalDeliveryAddress }) {
  const notices = requiresPhysicalDeliveryAddress
    ? [
        'Your contact and mailing details are used only for payment, print delivery, and order support.',
        'If there is a print-fulfillment issue, we will fix it or refund you.',
      ]
    : [
        'Your email is used for your receipt, finished photo, and order updates.',
        'If your order is not delivered as promised, we will make it right or refund you.',
      ];

  return (
    <div className="rounded-[22px] border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-950">Protected checkout</div>
          <div className="mt-2 space-y-1.5">
            {notices.map((notice) => (
              <p key={notice} className="text-sm leading-6 text-slate-600">
                {notice}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentVerificationSkeleton({ message }) {
  return (
    <section className="surface-card animate-fade-up overflow-hidden p-0">
      <div className="bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_56%),linear-gradient(180deg,#f8fbff_0%,#ffffff_72%)] px-5 py-6 sm:px-7 sm:py-8">
        <div className="mx-auto max-w-[40rem]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_18px_38px_-24px_rgba(37,99,235,0.58)]">
              <LoaderCircle className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.24em] text-blue-700">
                Waiting for payment
              </div>
              <h2 className="mt-1 text-[1.35rem] font-semibold tracking-tight text-slate-950 sm:text-[1.6rem]">
                Confirming your Stripe payment
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[0.97rem]">
            {message || 'Please wait while we confirm your payment and prepare your order.'}
          </p>

          <div className="mt-6 rounded-[24px] border border-blue-100 bg-white/90 p-4 shadow-[0_24px_56px_-44px_rgba(15,23,42,0.35)] sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
              Processing payment return
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#60a5fa_100%)]" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 space-y-2">
                  <div className="h-10 animate-pulse rounded-2xl bg-white" />
                  <div className="h-10 animate-pulse rounded-2xl bg-white" />
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded-full bg-white" />
                  <div className="h-4 w-5/6 animate-pulse rounded-full bg-white" />
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-white" />
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500 sm:text-sm">
            Do not close this page. You will be redirected automatically as soon as payment verification finishes.
          </p>
        </div>
      </div>
    </section>
  );
}

function StickySummary({ item, cart, totals }) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
      <div className="rounded-[28px] border border-amber-200/70 bg-[linear-gradient(180deg,rgba(254,243,199,0.54),rgba(255,255,255,0.98))] p-5 shadow-[0_24px_64px_-50px_rgba(15,23,42,0.38)]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[1.35rem] font-semibold text-slate-950">
              {item?.documentName || 'Passport photo'}
            </div>
            <div className="mt-1 text-sm text-slate-500">{item?.sizeLabel || 'Photo format'}</div>
          </div>
          {item ? (
            <div className="h-[112px] w-[88px] shrink-0 overflow-hidden rounded-[24px] border border-white/80 bg-white p-2 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.46)]">
              <ProtectedPhotoPreview
                src={item.photo}
                alt={item.documentName}
                watermarkEnabled={Boolean(item.backgroundRemovalApplied)}
                className="h-full rounded-[16px] bg-white"
                imageClassName="rounded-[16px]"
                aspectRatio={`${item.outputWidth || 1} / ${item.outputHeight || 1}`}
              />
            </div>
          ) : null}
        </div>
      </div>

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
        compact
        footerNote="SSL-secured payment through Stripe Checkout."
      />
    </aside>
  );
}

export function CheckoutView({
  cart,
  user,
  authConfigured,
  totals,
  checkoutOptions,
  printCopyFees,
  complianceCheckFee = 0,
  photoRetouchingFee = 0,
  premiumRetouchFee = 0,
  premiumRetouchRequired = false,
  paymentState,
  canRetryVerification,
  onRetryVerification,
  onOpenAuth,
  onBack,
  backLabel = 'Back',
  onSubmit,
  loading,
  onPhotoPackageChange,
  onPrintCopiesChange,
  onToggleComplianceCheck,
  onTogglePhotoRetouching,
  onTogglePremium,
  onOpenPrivacy,
  onOpenTerms,
}) {
  const isSignedIn = Boolean(user);
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState({
    firstName: user?.name?.split(' ')?.[0] || '',
    lastName: user?.name?.split(' ')?.slice(1).join(' ') || '',
    email: user?.email || '',
    phone: user?.phone || '',
    deliveryEmail: user?.email || '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: 'CA',
    postalCode: '',
    country: US_DELIVERY_COUNTRY,
  });
  const [errors, setErrors] = useState({});

  const primaryItem = cart[0];
  const isVerifying = paymentState?.status === 'verifying';
  const isSuccess = paymentState?.status === 'success';
  const isError = paymentState?.status === 'error';
  const manualFulfillmentRequired =
    checkoutOptions.complianceCheck || checkoutOptions.photoRetouching || checkoutOptions.premiumRetouch;
  const requiresPhysicalDeliveryAddress = checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints;
  const selectedState = getUsStateByCode(customer.stateProvince);
  const suggestedCities = useMemo(() => getUsCitiesByState(customer.stateProvince), [customer.stateProvince]);
  const suggestedZips = useMemo(
    () => getUsZipsByStateAndCity(customer.stateProvince, customer.city),
    [customer.city, customer.stateProvince],
  );

  const submitLabel = isVerifying
    ? 'Verifying payment...'
    : loading
      ? 'Redirecting to Stripe...'
      : 'Pay now';

  const helperPoints = useMemo(() => {
    const points = [
      'Secure payment is handled by Stripe.',
      'Guest checkout is available.',
      requiresPhysicalDeliveryAddress
        ? `${getPrintCopyLabel(checkoutOptions.printCopies)} print orders need a U.S. delivery address.`
        : manualFulfillmentRequired
          ? 'Manual services use your email for finished-image delivery.'
          : 'Your finished digital image is sent to your receipt email.',
    ];

    if (authConfigured && !isSignedIn) {
      points.splice(2, 0, 'Sign in only if you want dashboard access.');
    }

    return points;
  }, [authConfigured, checkoutOptions.printCopies, isSignedIn, manualFulfillmentRequired, requiresPhysicalDeliveryAddress]);

  useEffect(() => {
    if (isVerifying || isSuccess || isError) {
      setStep(3);
    }
  }, [isError, isSuccess, isVerifying]);

  function handleFieldChange(field, value) {
    setCustomer((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function handleStateChange(value) {
    const resolvedState = resolveUsState(value);
    const nextStateCode = resolvedState?.code || String(value || '').trim().toUpperCase();

    setCustomer((current) => {
      const resolvedCity = resolveUsCity(nextStateCode, current.city);
      return {
        ...current,
        stateProvince: nextStateCode,
        city: resolvedCity || current.city,
      };
    });

    if (errors.stateProvince || errors.city) {
      setErrors((current) => ({
        ...current,
        stateProvince: undefined,
        city: undefined,
      }));
    }
  }

  function handleAddressFieldBlur(field) {
    setCustomer((current) => {
      if (field === 'country') {
        return {
          ...current,
          country: resolveUsCountryName(current.country) || US_DELIVERY_COUNTRY,
        };
      }

      if (field === 'city') {
        const resolvedCity = resolveUsCity(current.stateProvince, current.city);
        if (resolvedCity && resolvedCity !== current.city) {
          return { ...current, city: resolvedCity };
        }
      }

      if (field === 'postalCode') {
        const zipMatch = lookupUsZip(current.postalCode);
        if (zipMatch) {
          return {
            ...current,
            postalCode: zipMatch.zip,
            city: zipMatch.city,
            stateProvince: zipMatch.state,
            country: US_DELIVERY_COUNTRY,
          };
        }
      }

      return current;
    });
  }

  function handleContinueToPayment() {
    setStep(3);
  }

  function handleCheckoutSubmit(event) {
    const nextErrors = {};

    if (!customer.email.trim()) nextErrors.email = 'Required';
    if (requiresPhysicalDeliveryAddress && !customer.firstName.trim()) nextErrors.firstName = 'Required';
    if (requiresPhysicalDeliveryAddress && !customer.lastName.trim()) nextErrors.lastName = 'Required';
    if (requiresPhysicalDeliveryAddress && !customer.addressLine1.trim()) nextErrors.addressLine1 = 'Required';
    if (requiresPhysicalDeliveryAddress && !customer.city.trim()) nextErrors.city = 'Required';
    if (requiresPhysicalDeliveryAddress && !customer.stateProvince.trim()) nextErrors.stateProvince = 'Required';
    if (requiresPhysicalDeliveryAddress && !customer.postalCode.trim()) nextErrors.postalCode = 'Required';
    if (requiresPhysicalDeliveryAddress && resolveUsCountryName(customer.country) !== US_DELIVERY_COUNTRY) {
      nextErrors.country = 'Print delivery is available in the United States only.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      event.preventDefault();
      return;
    }

    onSubmit(event);
  }

  return (
    <FlowShell
      currentView={VIEWS.checkout}
      title="Checkout"
      description="Choose the package, add optional services, then continue to secure Stripe checkout."
      onBack={step === 1 ? onBack : () => setStep((current) => current - 1)}
      backLabel={step === 1 ? backLabel : 'Back'}
      chip={null}
      showFlowStepper={false}
      compactHeader
      summaryItems={[]}
    >
      <form onSubmit={handleCheckoutSubmit}>
        <input type="hidden" name="firstName" value={customer.firstName} />
        <input type="hidden" name="lastName" value={customer.lastName} />
        <input type="hidden" name="email" value={customer.email} />
        <input type="hidden" name="phone" value={customer.phone} />
        <input type="hidden" name="deliveryEmail" value={customer.deliveryEmail} />
        <input type="hidden" name="addressLine1" value={customer.addressLine1} />
        <input type="hidden" name="addressLine2" value={customer.addressLine2} />
        <input type="hidden" name="city" value={customer.city} />
        <input type="hidden" name="stateProvince" value={customer.stateProvince} />
        <input type="hidden" name="postalCode" value={customer.postalCode} />
        <input type="hidden" name="country" value={customer.country} />

        <div className="space-y-3">
          <TopStepper currentStep={isVerifying ? 3 : step} />
          <MobileStepper currentStep={isVerifying ? 3 : step} />

          {isVerifying ? (
            <PaymentVerificationSkeleton message={paymentState?.message} />
          ) : (
          <div className={step === 3 ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_304px] xl:items-start' : ''}>
            <div className="space-y-3">

              {step === 1 ? (
                <section className="surface-card animate-fade-up p-4 sm:p-5">
                  <div className="mb-4 sm:hidden">
                    <SelectedPhotoStrip item={primaryItem} total={totals.total} />
                  </div>

                  <SectionIntro
                    icon={<Package2 className="h-5 w-5" />}
                    title="Choose your package"
                    copy="Choose the package before Stripe payment. Keep it simple and pick the delivery format you want."
                    tone="blue"
                  />

                  <div className="mt-4 hidden sm:block">
                    <SelectedPhotoStrip item={primaryItem} total={totals.total} />
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-semibold text-slate-950">Delivery format</div>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      Pick the option that matches how you want to receive the finished photo.
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      Selected: {getPhotoPackageLabel(checkoutOptions.photoPackage, checkoutOptions.printCopies)}
                    </p>
                  </div>

                  <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-2">
                    <PackageCard
                      active={checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digital}
                      title="Digital Photo"
                      feeLabel={formatCurrency(totals.subtotal)}
                      icon={<Download className="h-4 w-4" />}
                      details={[
                        'Instant online download',
                        'Ready for online submission and self-printing',
                      ]}
                      helper={(
                        <div className="space-y-2">
                          <div>Self-print support</div>
                          <StoreSupportGrid />
                        </div>
                      )}
                      onClick={() => onPhotoPackageChange(PHOTO_PACKAGE_TYPES.digital)}
                    />

                    <PackageCard
                      active={checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints}
                      title="Digital Photo + Printouts"
                      feeLabel={`+${formatCurrency(Number(printCopyFees?.[`digitalPrint${checkoutOptions.printCopies}CopyFee`] || 0))}`}
                      icon={<Printer className="h-4 w-4" />}
                      details={[
                        'Printed photos with free delivery',
                        'Digital photo for online submission and self-printing',
                      ]}
                      helper="Estimated delivery: 2 to 3 business days."
                      extra={checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints ? (
                        <PrintCopySelector
                          value={checkoutOptions.printCopies}
                          onChange={onPrintCopiesChange}
                          printCopyFees={printCopyFees}
                        />
                      ) : null}
                      onClick={() => onPhotoPackageChange(PHOTO_PACKAGE_TYPES.digitalPrints)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="primary-button mt-3 w-full justify-center text-base sm:w-auto sm:min-w-[240px]"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="secondary-button mt-3 w-full justify-center sm:ml-3 sm:w-auto"
                  >
                    Skip options, go to contact/delivery
                  </button>
                </section>
              ) : null}

              {step === 2 ? (
                <section className="surface-card animate-fade-up p-4 sm:p-5">
                  <SectionIntro
                    icon={<Sparkles className="h-5 w-5" />}
                    title="Upgrade your order"
                    copy="Add only the services that improve acceptance confidence or need manual cleanup."
                    tone="amber"
                  />

                  <div className="mt-4">
                    <SelectedPhotoStrip item={primaryItem} total={totals.total} />
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-semibold text-slate-950">Add optional services</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Short, useful extras. No oversized boxes, just clear upgrade choices.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <AddOnCard
                      active={checkoutOptions.complianceCheck}
                      title="Expert check & acceptance guarantee"
                      priceLabel={`+${formatCurrency(complianceCheckFee)}`}
                      description="Add a compliance review by a photo expert with an acceptance guarantee."
                      icon={<ShieldCheck className="h-4 w-4" />}
                      onClick={onToggleComplianceCheck}
                    />

                    <AddOnCard
                      active={checkoutOptions.photoRetouching}
                      title="Photo retouching"
                      priceLabel={`+${formatCurrency(photoRetouchingFee)}`}
                      description="Clean up minor imperfections for a more polished ID photo."
                      icon={<Paintbrush2 className="h-4 w-4" />}
                      onClick={onTogglePhotoRetouching}
                    />

                    <AddOnCard
                      active={checkoutOptions.premiumRetouch || premiumRetouchRequired}
                      title="Premium retouch / background cleanup"
                      priceLabel={`+${formatCurrency(premiumRetouchFee)}`}
                      description={
                        premiumRetouchRequired
                          ? 'This order needs manual cleanup, so premium retouch stays enabled.'
                          : 'Use this when manual background cleanup or extra polish is needed.'
                      }
                      icon={<Sparkles className="h-4 w-4" />}
                      onClick={premiumRetouchRequired ? () => {} : onTogglePremium}
                    />
                  </div>

                  <div className="mt-3">
                    <ReviewChecklist />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="secondary-button w-full justify-center sm:w-auto sm:min-w-[120px]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueToPayment}
                      className="primary-button w-full justify-center text-base"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="secondary-button w-full justify-center sm:w-auto"
                    >
                      Skip add-ons
                    </button>
                  </div>
                </section>
              ) : null}

              {step === 3 ? (
                <section className="surface-card animate-fade-up p-4 sm:p-5">
                  <SectionIntro
                    icon={<Mail className="h-5 w-5" />}
                    title="Contact & Delivery"
                    copy={
                      requiresPhysicalDeliveryAddress
                        ? 'Add your email and U.S. delivery address for print delivery.'
                        : 'Enter your email and continue to secure payment.'
                    }
                    tone="emerald"
                  />

                  <div className="mx-auto mt-4 max-w-[42rem] space-y-4">
                    {isSignedIn ? (
                      <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <div className="text-sm font-semibold text-slate-950">Signed in</div>
                        <p className="mt-0.5 text-sm leading-5 text-slate-600">
                          This order will be saved to your dashboard automatically after payment.
                        </p>
                      </div>
                    ) : null}

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          {requiresPhysicalDeliveryAddress ? 'Email' : 'Email to proceed to payment'}
                        </label>
                        <input
                          type="email"
                          value={customer.email}
                          onChange={(event) => handleFieldChange('email', event.target.value)}
                          className={`input-shell ${errors.email ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                          placeholder="you@example.com"
                          autoComplete="email"
                          required
                        />
                        {errors.email ? <p className="text-xs text-red-600">{errors.email}</p> : null}
                        <p className="text-xs leading-5 text-slate-500">
                          By placing this order you agree to the{' '}
                          <button type="button" onClick={onOpenPrivacy} className="font-semibold text-blue-700 hover:text-blue-800">
                            Privacy Policy
                          </button>{' '}
                          and{' '}
                          <button type="button" onClick={onOpenTerms} className="font-semibold text-blue-700 hover:text-blue-800">
                            Terms of Use
                          </button>
                          .
                        </p>
                      </div>

                      {requiresPhysicalDeliveryAddress ? (
                        <>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">Full name</label>
                              <input
                                type="text"
                                value={[customer.firstName, customer.lastName].filter(Boolean).join(' ')}
                                onChange={(event) => {
                                  const parts = String(event.target.value || '').trim().split(/\s+/).filter(Boolean);
                                  handleFieldChange('firstName', parts[0] || '');
                                  handleFieldChange('lastName', parts.slice(1).join(' '));
                                }}
                                className={`input-shell ${
                                  errors.firstName || errors.lastName ? 'border-red-400 ring-1 ring-red-300' : ''
                                }`}
                                placeholder="Full name"
                                autoComplete="name"
                                required
                              />
                              {errors.firstName || errors.lastName ? (
                                <p className="text-xs text-red-600">Full name is required.</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Street address</label>
                            <input
                              type="text"
                              value={customer.addressLine1}
                              onChange={(event) => handleFieldChange('addressLine1', event.target.value)}
                              onBlur={() => handleAddressFieldBlur('addressLine1')}
                              className={`input-shell ${errors.addressLine1 ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                              placeholder="Street address"
                              autoComplete="address-line1"
                              required
                            />
                            {errors.addressLine1 ? <p className="text-xs text-red-600">{errors.addressLine1}</p> : null}
                          </div>

                          <div className="mt-3 space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">
                              Apartment, suite, etc. <span className="font-normal text-slate-400">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={customer.addressLine2}
                              onChange={(event) => handleFieldChange('addressLine2', event.target.value)}
                              onBlur={() => handleAddressFieldBlur('addressLine2')}
                              className="input-shell"
                              placeholder="Apartment, suite, unit, building"
                              autoComplete="address-line2"
                            />
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">City</label>
                              <input
                                type="text"
                                value={customer.city}
                                onChange={(event) => handleFieldChange('city', event.target.value)}
                                onBlur={() => handleAddressFieldBlur('city')}
                                list="us-city-suggestions"
                                className={`input-shell ${errors.city ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                                placeholder={selectedState ? `City in ${selectedState.name}` : 'City'}
                                autoComplete="address-level2"
                                required
                              />
                              {suggestedCities.length ? (
                                <datalist id="us-city-suggestions">
                                  {suggestedCities.map((city) => (
                                    <option key={city} value={city} />
                                  ))}
                                </datalist>
                              ) : null}
                              {selectedState ? (
                                <p className="text-xs leading-5 text-slate-500">
                                  Start typing and we will suggest cities for {selectedState.name}.
                                </p>
                              ) : null}
                              {errors.city ? <p className="text-xs text-red-600">{errors.city}</p> : null}
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">ZIP code</label>
                              <input
                                type="text"
                                value={customer.postalCode}
                                onChange={(event) => handleFieldChange('postalCode', event.target.value)}
                                onBlur={() => handleAddressFieldBlur('postalCode')}
                                list="us-zip-suggestions"
                                className={`input-shell ${errors.postalCode ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                                placeholder="ZIP code"
                                autoComplete="postal-code"
                                required
                              />
                              {suggestedZips.length ? (
                                <datalist id="us-zip-suggestions">
                                  {suggestedZips.slice(0, 250).map((zip) => (
                                    <option key={zip} value={zip} />
                                  ))}
                                </datalist>
                              ) : null}
                              {suggestedZips.length ? (
                                <p className="text-xs leading-5 text-slate-500">
                                  ZIP suggestions update from the selected state and city.
                                </p>
                              ) : (
                                <p className="text-xs leading-5 text-slate-500">
                                  Enter any valid U.S. ZIP code and we will correct the city and state automatically.
                                </p>
                              )}
                              {errors.postalCode ? <p className="text-xs text-red-600">{errors.postalCode}</p> : null}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">State</label>
                              <select
                                value={customer.stateProvince}
                                onChange={(event) => handleStateChange(event.target.value)}
                                className={`input-shell ${errors.stateProvince ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                                autoComplete="address-level1"
                                required
                              >
                                {US_STATE_OPTIONS.map((state) => (
                                  <option key={state.code} value={state.code}>
                                    {state.name}
                                  </option>
                                ))}
                              </select>
                              <p className="text-xs leading-5 text-slate-500">
                                Delivery is limited to U.S. addresses for now.
                              </p>
                              {errors.stateProvince ? <p className="text-xs text-red-600">{errors.stateProvince}</p> : null}
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">Country</label>
                              <div className="flex items-center gap-2 rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                                <FlagMark src="/flags/us.svg" label={US_DELIVERY_COUNTRY} size="sm" />
                                <span>{US_DELIVERY_COUNTRY}</span>
                              </div>
                              <select
                                value={customer.country}
                                onChange={(event) => handleFieldChange('country', event.target.value)}
                                onBlur={() => handleAddressFieldBlur('country')}
                                className="sr-only"
                                autoComplete="country-name"
                                required
                              >
                                <option value={US_DELIVERY_COUNTRY}>{US_DELIVERY_COUNTRY}</option>
                              </select>
                              <p className="text-xs leading-5 text-slate-500">
                                Current print shipping is U.S. only.
                              </p>
                              {errors.country ? <p className="text-xs text-red-600">{errors.country}</p> : null}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>

                    <SafetyBadges />
                    <PaymentHelperBox helperPoints={helperPoints} />
                    <TrustNotice requiresPhysicalDeliveryAddress={requiresPhysicalDeliveryAddress} />
                  </div>

                <div className="mx-auto mt-4 max-w-[42rem]">
                  {isVerifying || isSuccess || isError ? (
                    <div
                      className={`rounded-[22px] border p-4 ${
                        isError
                          ? 'border-red-200 bg-red-50 text-red-800'
                          : isSuccess
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-blue-200 bg-blue-50 text-blue-800'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
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
                          className="secondary-button mt-3 justify-center"
                        >
                          <ArrowRight className="h-4 w-4" />
                          Check payment again
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="secondary-button w-full justify-center sm:w-auto sm:min-w-[120px]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={loading || isVerifying || !cart.length}
                      className="primary-button w-full justify-center text-base"
                    >
                      {loading || isVerifying ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                      ) : (
                        <LockKeyhole className="h-4 w-4" />
                      )}
                      {submitLabel}
                    </button>
                  </div>
                </div>
                </section>
              ) : null}
            </div>

            {step === 3 ? (
              <div>
                <StickySummary item={primaryItem} cart={cart} totals={totals} />
              </div>
            ) : null}
          </div>
          )}
        </div>
      </form>
    </FlowShell>
  );
}
