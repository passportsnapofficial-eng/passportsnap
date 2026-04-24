import { ChevronLeft } from 'lucide-react';
import { FlowStepper } from './FlowStepper';

function SummaryChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function FlowShell({
  currentView,
  title,
  description,
  onBack,
  backLabel = 'Back',
  chip,
  summaryItems = [],
  compactHeader = false,
  children,
}) {
  return (
    <div className="page-shell">
      <section className="border-b border-slate-200/80 bg-white/92 backdrop-blur">
        <div className={`mx-auto w-full max-w-[1120px] px-4 sm:px-6 ${compactHeader ? 'py-4 sm:py-5' : 'py-5 sm:py-7'}`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.4)] transition hover:border-slate-300 hover:text-slate-950 sm:w-auto"
              >
                <ChevronLeft className="h-4 w-4" />
                {backLabel}
              </button>

              {chip ? (
                <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  {chip}
                </div>
              ) : null}
            </div>

            <FlowStepper currentView={currentView} />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="max-w-3xl">
                <h1 className={`${compactHeader ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'} font-semibold tracking-tight text-slate-950`}>
                  {title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  {description}
                </p>
              </div>

              {summaryItems.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[18rem] lg:max-w-[24rem]">
                  {summaryItems.map((item) => (
                    <SummaryChip key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className={`mx-auto w-full max-w-[1120px] px-4 sm:px-6 ${compactHeader ? 'py-5 sm:py-6' : 'py-6 sm:py-8'}`}>
        {children}
      </div>
    </div>
  );
}
