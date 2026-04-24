import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function ComplianceChecklist({ checks }) {
  return (
    <div className="surface-card p-6 sm:p-7">
      <div className="text-sm font-semibold text-slate-900">First-pass export checks</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        These checks combine browser face detection when available with crop, dimension, and brightness analysis. They are not an official government approval.
      </p>

      <div className="mt-6 space-y-3">
        {checks.map((check) => {
          const passed = check.status === 'passed';
          const informational = check.status === 'info';

          return (
            <div
              key={check.key}
              className={`rounded-[28px] border p-4 ${
                passed
                  ? 'border-emerald-100 bg-emerald-50'
                  : informational
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-red-100 bg-red-50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl ${
                    passed
                      ? 'bg-white text-emerald-600'
                      : informational
                        ? 'bg-white text-slate-500'
                        : 'bg-white text-red-600'
                  }`}
                >
                  {passed ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{check.label}</div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        passed
                          ? 'bg-emerald-100 text-emerald-700'
                          : informational
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {passed ? 'Passed' : informational ? 'Info' : 'Needs work'}
                    </span>
                  </div>
                  {check.noteText ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{check.noteText}</p>
                  ) : null}
                  {!passed ? (
                    check.helpText ? <p className="mt-2 text-sm leading-6 text-slate-600">{check.helpText}</p> : null
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
