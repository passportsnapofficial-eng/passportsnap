import { AlertCircle, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { CAPTURE_MODES, VIEWS } from '../../lib/utils/constants';
import { FlowShell } from '../flow/FlowShell';
import { ResultActions } from './ResultActions';
import { ResultPreviewCard } from './ResultPreviewCard';
import { ValidationResults } from './ValidationResults';

export function ResultView({
  result,
  captureMode,
  requiresAuth = false,
  onOpenAuth,
  onProceedToCheckout,
  onRetake,
  onBack,
}) {
  const passed = result.status === 'passed';
  const retouchRequired = result.status === 'needs_retouch';
  const canProceed = Boolean(result.canProceedToCheckout);
  const detectedBackgroundTone = result.metadata?.analysis?.background?.backgroundTone || 'other';
  const detectedBackgroundToneLabel = result.metadata?.analysis?.background?.backgroundToneLabel || 'Unknown';
  const canOfferOptionalWhiteCleanup =
    canProceed &&
    result.backgroundCleanupAllowed &&
    !result.requiresPremiumRetouch &&
    detectedBackgroundTone !== 'white';
  const issueSummaryItems = result.issueSummaryItems || [];

  const heroMeta = passed
    ? {
        title: 'Photo meets first-pass requirements',
        description: 'The local validator found no blocking issue in the current export.',
        chip: 'Step 5 of 7',
        summaryResult: 'Passed first-pass review',
        pillClassName: 'bg-emerald-50 text-emerald-700',
        Icon: CheckCircle2,
        heading: 'Your photo is ready for review',
      }
    : retouchRequired
      ? {
          title: 'Background cleanup required before checkout',
          description: 'The validator found a recoverable background-color issue. Checkout can continue only with paid manual cleanup.',
          chip: 'Editor cleanup required',
          summaryResult: 'Editor cleanup required',
          pillClassName: 'bg-amber-50 text-amber-700',
          Icon: AlertCircle,
          heading: 'Continue with manual cleanup',
        }
      : {
          title: 'Photo does not meet requirements',
          description: 'The local validator found one or more blocking issues, so checkout stays locked until the photo is corrected.',
          chip: 'Retake recommended',
          summaryResult: 'Retake needed',
          pillClassName: 'bg-red-50 text-red-700',
          Icon: AlertCircle,
          heading: 'Retake before checkout',
        };
  const HeroIcon = heroMeta.Icon;

  if (requiresAuth) {
    return (
      <FlowShell
        currentView={VIEWS.result}
        title="Sign in to unlock your result"
        description="Your photo has been processed. Sign in or create an account to reveal the reviewed result and continue to checkout."
        onBack={onBack}
        backLabel="Back to review"
        chip="Step 5 of 7"
        compactHeader
        summaryItems={[
          { label: 'Document', value: result.countryLabel },
          { label: 'Size', value: result.sizeLabel },
          { label: 'Source', value: captureMode === CAPTURE_MODES.camera ? 'Take photo' : 'Upload' },
          { label: 'Status', value: 'Ready to unlock' },
        ]}
      >
        <div className="mx-auto max-w-3xl">
          <div className="surface-card p-6 sm:p-8 animate-slide-up">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex h-14 w-14 items-center justify-center rounded-[24px] bg-blue-50 text-blue-600">
                <LockKeyhole className="h-7 w-7" />
              </div>

              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  <ShieldCheck className="h-4 w-4" />
                  Result ready
                </div>

                <h2 className="mt-5 text-3xl font-semibold text-slate-900">
                  Create an account or sign in to continue
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-600">
                  The photo was processed successfully. Sign in now to reveal the result, save it
                  to your account, and continue to payment when you are ready.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Document
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{result.countryLabel}</div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Size
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{result.sizeLabel}</div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Next step
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">Unlock result</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={onOpenAuth} className="primary-button justify-center">
                    Continue
                  </button>
                  <button type="button" onClick={onBack} className="secondary-button justify-center">
                    Back to review
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FlowShell>
    );
  }

  return (
    <FlowShell
      currentView={VIEWS.result}
      title={heroMeta.title}
      description={heroMeta.description}
      onBack={onBack}
      backLabel="Back to review"
      chip={heroMeta.chip}
      compactHeader
      summaryItems={[
        { label: 'Document', value: result.countryLabel },
        { label: 'Size', value: result.sizeLabel },
        { label: 'Source', value: captureMode === CAPTURE_MODES.camera ? 'Take photo' : 'Upload' },
        { label: 'Result', value: heroMeta.summaryResult },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <ResultPreviewCard result={result} />

        <div className="space-y-6">
          <ResultActions
            canProceed={canProceed}
            requiresPremiumRetouch={Boolean(result.requiresPremiumRetouch)}
            onProceedToCheckout={onProceedToCheckout}
            onRetake={onRetake}
          />

          <div className="surface-card p-6 sm:p-7 animate-slide-up">
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${heroMeta.pillClassName}`}>
              <HeroIcon className="h-4 w-4" />
              {result.headline}
            </div>

            <h2 className="mt-5 text-3xl font-semibold text-slate-900">
              {heroMeta.heading}
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">{result.message}</p>
            <p className="mt-3 text-sm leading-7 text-slate-500">{result.detail}</p>

            {issueSummaryItems.length ? (
              <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-900">Detected issues summary</div>
                {result.issueSummary ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{result.issueSummary}</p>
                ) : null}
                <div className="mt-4 space-y-3">
                  {issueSummaryItems.map((issue) => (
                    <div
                      key={issue.key}
                      className={`rounded-2xl px-4 py-3 text-sm ${
                        issue.recoverable ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-900'
                      }`}
                    >
                      <div className="font-semibold">{issue.label}</div>
                      {issue.helpText ? <p className="mt-1 leading-6 text-current/80">{issue.helpText}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">What happens next</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {retouchRequired
                  ? 'The preview here is the source export. A manual editor will clean up the background before final delivery if you continue.'
                  : 'The preview here is the exact export that would be attached to the order if checkout is enabled.'}
              </p>
              {result.authority ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  The active format data comes from published guidance by {result.authority}.
                </p>
              ) : null}
              {retouchRequired ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Some authorities reject edited backgrounds or other altered photos. Confirm the document rules before using this paid cleanup path.
                </p>
              ) : null}
              {result.requiresUnalteredPhoto && !result.backgroundRemovalApplied ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  This document is treated as an unaltered-photo workflow. The app validates framing and quality, but does not apply automatic retouching to the final export.
                </p>
              ) : null}
              {canOfferOptionalWhiteCleanup ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  A {detectedBackgroundToneLabel.toLowerCase()} background was detected. Premium retouch can still replace it with white at checkout if you want the safer finish.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <ValidationResults checks={result.checks} />
      </div>
    </FlowShell>
  );
}
