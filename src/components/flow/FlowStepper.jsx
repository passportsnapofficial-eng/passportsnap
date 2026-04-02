import { Check } from 'lucide-react';
import { FLOW_STEPS } from '../../lib/utils/constants';

export function FlowStepper({ currentView }) {
  const currentIndex = FLOW_STEPS.findIndex((step) => step.view === currentView);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
      <div className="flex min-w-max items-center gap-3">
        {FLOW_STEPS.map((step, index) => {
          const isComplete = currentIndex > index;
          const isActive = currentIndex === index;

          return (
            <div key={step.view} className="flex items-center gap-3">
              <div
                className={`flex items-center gap-3 rounded-full border px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'border-white/30 bg-white/12 text-white shadow-[0_18px_48px_-30px_rgba(148,163,184,0.9)]'
                    : isComplete
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                      : 'border-white/10 bg-white/5 text-slate-300'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? 'bg-white text-slate-950'
                      : isComplete
                        ? 'bg-emerald-300 text-emerald-950'
                        : 'bg-white/10 text-slate-200'
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className="whitespace-nowrap">{step.shortLabel}</span>
              </div>

              {index < FLOW_STEPS.length - 1 ? (
                <div className={`h-px w-6 sm:w-10 ${currentIndex > index ? 'bg-emerald-300/60' : 'bg-white/12'}`} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
