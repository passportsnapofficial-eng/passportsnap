import { ChevronLeft } from 'lucide-react';
import { FlowStepper } from './FlowStepper';

export function FlowShell({
  currentView,
  title,
  description,
  onBack,
  backLabel = 'Back',
  chip,
  children,
}) {
  return (
    <div className="page-shell">
      <section className="relative overflow-hidden border-b border-white/10 bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.28),_transparent_34%),radial-gradient(circle_at_left_center,_rgba(14,165,233,0.16),_transparent_26%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
                {backLabel}
              </button>
              {chip ? (
                <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                  {chip}
                </div>
              ) : null}
            </div>

            <FlowStepper currentView={currentView} />

            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                {description}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</div>
    </div>
  );
}
