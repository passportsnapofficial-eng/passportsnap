import { Check } from 'lucide-react';
import { FLOW_STEPS, VIEWS } from '../../lib/utils/constants';

function resolveCurrentStepView(currentView) {
  if (currentView === VIEWS.result) {
    return VIEWS.review;
  }

  return currentView;
}

export function FlowStepper({ currentView }) {
  const resolvedView = resolveCurrentStepView(currentView);
  const currentIndex = FLOW_STEPS.findIndex((step) => step.view === resolvedView);

  if (currentIndex === -1) {
    return null;
  }

  return (
    <div className="snap-strip">
      <div className="flex min-w-max items-center gap-2.5 sm:gap-3">
        {FLOW_STEPS.map((step, index) => {
          const isComplete = currentIndex > index;
          const isActive = currentIndex === index;

          return (
            <div key={step.view} className="snap-panel flex items-center gap-2.5 sm:gap-3">
              <div
                className={`flex items-center gap-2.5 rounded-full border px-3 py-2 text-sm transition ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : isComplete
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? 'bg-white text-slate-900'
                      : isComplete
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className="whitespace-nowrap font-medium">{step.shortLabel}</span>
              </div>

              {index < FLOW_STEPS.length - 1 ? (
                <div className={`h-px w-5 sm:w-8 ${currentIndex > index ? 'bg-emerald-300' : 'bg-slate-200'}`} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
