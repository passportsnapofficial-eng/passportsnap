import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { VIEWS } from '../../lib/utils/constants';
import { FlowShell } from '../flow/FlowShell';
import { ComplianceChecklist } from './ComplianceChecklist';
import { ResultActions } from './ResultActions';
import { ResultPreviewCard } from './ResultPreviewCard';

export function ResultView({ result, onProceedToCheckout, onReviewCart, onRetake }) {
  const passed = result.status === 'passed';

  return (
    <FlowShell
      currentView={VIEWS.result}
      title={passed ? 'Initial check passed' : 'This photo needs another try'}
      description={
        passed
          ? 'The automated first-pass review found the photo clear enough to continue into checkout.'
          : 'The review found something that should be corrected before payment, so the retake path stays front and center.'
      }
      onBack={onRetake}
      backLabel="Back to capture"
      chip={passed ? 'Step 4 of 6' : 'Retake recommended'}
    >
      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <ResultPreviewCard result={result} />

        <div className="space-y-6">
          <div className="surface-card p-6 sm:p-7 animate-slide-up">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {passed ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {result.headline}
            </div>

            <h2 className="mt-5 text-3xl font-semibold text-slate-900">
              {passed ? 'Your photo is ready for review' : 'Retake before checkout'}
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">{result.message}</p>
            <p className="mt-3 text-sm leading-7 text-slate-500">{result.detail}</p>

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">What happens next</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The processed preview below is the same export that will attach to the order if the
                user continues.
              </p>
              {result.authority ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  The active format data comes from published guidance by {result.authority}.
                </p>
              ) : null}
            </div>
          </div>

          <ResultActions
            canProceed={passed}
            onProceedToCheckout={onProceedToCheckout}
            onReviewCart={onReviewCart}
            onRetake={onRetake}
          />
        </div>
      </div>

      <div className="mt-6">
        <ComplianceChecklist checks={result.checks} />
      </div>
    </FlowShell>
  );
}
