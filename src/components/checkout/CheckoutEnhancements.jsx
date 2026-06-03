import {
  CheckCircle2,
  Download,
  Paintbrush2,
  Printer,
  Radio,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  getPrintCopyLabel,
  PHOTO_PACKAGE_TYPES,
  PRINT_COPY_OPTIONS,
} from '../../lib/checkout/pricing';
import { formatCurrency } from '../../lib/utils/formatters';

const STORE_CHIPS = [
  { name: 'CVS', src: '/CVS.webp', imageClassName: 'h-4 sm:h-5' },
  { name: 'Walgreens', src: '/Walgreens.png', imageClassName: 'h-4 sm:h-5' },
  { name: 'Walmart', src: '/Walmart-Logo.png', imageClassName: 'h-4 sm:h-5' },
  { name: 'FedEx', src: '/fedex.png', imageClassName: 'h-4 sm:h-5' },
];

function OptionCard({ active, onClick, title, feeLabel, children, selectionType = 'radio', extra = null }) {
  const SelectionIcon = active ? CheckCircle2 : selectionType === 'checkbox' ? CheckCircle2 : Radio;

  return (
    <div className="flex h-full flex-col gap-3">
      <button
        type="button"
        onClick={onClick}
        className={`flex h-full w-full rounded-[32px] border p-5 text-left transition ${
          active
            ? 'border-blue-500 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(255,255,255,1))] ring-4 ring-blue-100 shadow-[0_24px_56px_-32px_rgba(59,130,246,0.45)]'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                active
                  ? 'border-blue-200 bg-white text-blue-600'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              <SelectionIcon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[1.05rem] font-semibold text-slate-900">{title}</div>
                {active ? (
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                    Selected
                  </span>
                ) : null}
              </div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">{children}</div>
            </div>
          </div>
          {feeLabel ? (
            <div className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
              {feeLabel}
            </div>
          ) : null}
        </div>
      </button>
      {extra ? <div>{extra}</div> : null}
    </div>
  );
}

function ExamplePanel({ title, items = [] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{item}</span>
          </div>
        ))}
      </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
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
              className={`rounded-2xl border px-2 py-2 text-center transition ${
                active
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
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

export function CheckoutEnhancements({
  checkoutOptions,
  printCopyFees,
  complianceCheckFee = 0,
  photoRetouchingFee = 0,
  premiumRetouchFee = 0,
  premiumRetouchRequired = false,
  onPhotoPackageChange,
  onPrintCopiesChange,
  onToggleComplianceCheck,
  onTogglePhotoRetouching,
  onTogglePremium,
  sections = ['package', 'services', 'premium'],
  compact = false,
}) {
  const showPackage = sections.includes('package');
  const showServices = sections.includes('services');
  const showPremium = sections.includes('premium');

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {showPackage ? (
      <section className={compact ? 'space-y-3' : 'space-y-4'}>
        <div>
          <div className="text-sm font-semibold text-slate-900">Choose the photo option</div>
          <p className="mt-1 text-sm text-slate-500">
            Pick the delivery format the customer wants before payment.
          </p>
        </div>

        <div className={`grid items-stretch ${compact ? 'gap-3' : 'gap-4 xl:grid-cols-2'}`}>
          <OptionCard
            active={checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digital}
            onClick={() => onPhotoPackageChange(PHOTO_PACKAGE_TYPES.digital)}
            title="Digital Photo"
            feeLabel={null}
          >
            <div className="flex items-start gap-2.5">
              <Download className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
              <span>Instant online download</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Printer className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
              <span>Ready for online submission and self-printing</span>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-xs leading-6 text-slate-500">
              <div className="mb-2">Self-print support</div>
              <StoreSupportGrid />
            </div>
          </OptionCard>

          <OptionCard
            active={checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints}
            onClick={() => onPhotoPackageChange(PHOTO_PACKAGE_TYPES.digitalPrints)}
            title="Digital Photo + Printouts"
            feeLabel={`+${formatCurrency(Number(printCopyFees?.[`digitalPrint${checkoutOptions.printCopies}CopyFee`] || 0))}`}
            extra={checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints ? (
              <PrintCopySelector
                value={checkoutOptions.printCopies}
                onChange={onPrintCopiesChange}
                printCopyFees={printCopyFees}
              />
            ) : null}
          >
            <div className="flex items-start gap-2.5">
              <Truck className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
              <span>Printed photos with free delivery</span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
              <span>Digital photo for online submission and self-printing</span>
            </div>
          </OptionCard>
        </div>
      </section>
      ) : null}

      {showServices ? (
      <section className={compact ? 'space-y-3' : 'space-y-4'}>
        <div>
          <div className="text-sm font-semibold text-slate-900">Manual services</div>
          <p className="mt-1 text-sm text-slate-500">
            Add expert review or cosmetic cleanup when the customer wants extra assurance.
          </p>
        </div>

        <div className={`grid items-stretch ${compact ? 'gap-3' : 'gap-4 md:grid-cols-2 xl:grid-cols-3'}`}>
          <OptionCard
            active={checkoutOptions.complianceCheck}
            onClick={onToggleComplianceCheck}
            title="Expert check & acceptance guarantee"
            feeLabel={`+${formatCurrency(complianceCheckFee)}`}
            selectionType="checkbox"
          >
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
              <span>Add a compliance check with official requirements performed by a photo expert, backed by a 200% refund guarantee.</span>
            </div>
          </OptionCard>

          <OptionCard
            active={checkoutOptions.photoRetouching}
            onClick={onTogglePhotoRetouching}
            title="Photo retouching"
            feeLabel={`+${formatCurrency(photoRetouchingFee)}`}
            selectionType="checkbox"
          >
            <div className="flex items-start gap-2">
              <Paintbrush2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
              <span>Get rid of minor imperfections and deliver a cleaner ID photo.</span>
            </div>
          </OptionCard>
        </div>

        {!compact ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <ExamplePanel
              title="Compliance check example"
              items={[
                'Expert confirms head size, eye line, crop, and background match official requirements.',
                'If something still looks risky, the order can be held for a corrected delivery before the customer downloads it.',
              ]}
            />
            <ExamplePanel
              title="Retouching examples"
              items={[
                'Remove temporary skin imperfections like pimples.',
                'Reduce under-eye shadows.',
                'Remove single stray hairs.',
                'Clean up small spots or dust from the camera lens or scanner.',
              ]}
            />
          </div>
        ) : null}
      </section>
      ) : null}

      {showPremium ? (
      <section className={compact ? 'space-y-3' : 'space-y-4'}>
        <div>
          <div className="text-sm font-semibold text-slate-900">Background cleanup / premium review</div>
          <p className="mt-1 text-sm text-slate-500">
            Use this when automatic cleanup is not enough or a manual white-background pass is needed.
          </p>
        </div>

        <div className={compact ? '' : 'max-w-[30rem]'}>
          <OptionCard
            active={checkoutOptions.premiumRetouch || premiumRetouchRequired}
            onClick={premiumRetouchRequired ? undefined : onTogglePremium}
            title="Premium retouch / background cleanup"
            feeLabel={`+${formatCurrency(premiumRetouchFee)}`}
            selectionType="checkbox"
          >
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
              <span>
                {premiumRetouchRequired
                  ? 'This order needs manual background cleanup before final delivery, so the add-on stays enabled.'
                  : 'For customers who want additional fine-tuning, white-background cleanup, or manual review before final delivery.'}
              </span>
            </div>
          </OptionCard>
        </div>
      </section>
      ) : null}
    </div>
  );
}
