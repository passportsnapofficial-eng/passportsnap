import { ArrowRight, CheckCircle2, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import { CAPTURE_MODES, VIEWS } from '../../lib/utils/constants';
import { FlowShell } from '../flow/FlowShell';
import { FlagMark } from '../shared/FlagMark';
import { ProtectedPhotoPreview } from '../shared/ProtectedPhotoPreview';

function getReviewCopy(result) {
  if (result.status === 'needs_retake') {
    return {
      eyebrow: "Let's fix this",
      title: 'Take one more photo',
      description: 'A few things need adjusting before this one is ready.',
      canCheckout: false,
      ctaLabel: 'Retake Photo',
    };
  }

  if (result.status === 'needs_retouch') {
    return {
      eyebrow: 'Almost ready',
      title: 'One quick step left',
      description: "Finish checkout and we'll handle the final cleanup before delivery.",
      canCheckout: true,
      ctaLabel: 'Proceed to checkout',
    };
  }

  return {
    eyebrow: 'Your photo is ready',
    title: 'Your photo is ready',
    description: 'Take a look, then finish checkout to unlock the download.',
    canCheckout: true,
    ctaLabel: 'Proceed to checkout',
  };
}

export function ReviewView({
  result,
  captureMode,
  isNavigating = false,
  onDownload,
  onRetake,
  onBack,
}) {
  const copy = getReviewCopy(result);
  const rejectionReasons = Array.isArray(result.rejectionReasons)
    ? result.rejectionReasons.filter(Boolean).slice(0, 5)
    : [];
  const retakeTips = rejectionReasons.length
    ? rejectionReasons
    : (result.failedChecks || []).slice(0, 3).map((item) => item.helpText || item.label);
  const advisoryTips = Array.isArray(result.checks)
    ? result.checks
      .filter((item) => item.group === 'Background' && item.status === 'info')
      .slice(0, 3)
      .map((item) => item.noteText || item.helpText || item.label)
    : [];
  const processingSummary = result.requiresPremiumRetouch
    ? 'Prepared for the final cleanup'
    : result.backgroundRemovalApplied
      ? 'Background cleaned up automatically'
      : result.requiresUnalteredPhoto
        ? 'Kept unedited to match authority rules'
        : 'Prepared without retouching';
  const guidanceItems = copy.canCheckout
    ? [
        'Sized and framed for passport use',
        processingSummary,
        'Ready for secure checkout',
      ]
    : [
        'Use one clear face in the frame',
        'Keep your head straight and centered',
        'Use softer light and a plain background',
      ];

  return (
    <FlowShell
      currentView={VIEWS.review}
      title={copy.title}
      description={copy.description}
      onBack={onBack}
      backLabel="Back to photo"
      chip="Step 4 of 4"
      compactHeader
      summaryItems={[
        { label: 'Document', value: result.countryLabel },
        { label: 'Format', value: result.sizeLabel },
        { label: 'Source', value: captureMode === CAPTURE_MODES.camera ? 'Selfie' : 'Upload' },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_24rem]">
        <section className="surface-card overflow-hidden p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {result.flagPath ? <FlagMark src={result.flagPath} label={result.countryLabel} size="lg" /> : null}
              <div>
                <div className="text-sm font-semibold text-slate-900">{result.countryLabel}</div>
                <div className="text-sm text-slate-500">{result.documentName}</div>
              </div>
            </div>

            <div className={`rounded-full px-4 py-2 text-sm font-semibold ${
              copy.canCheckout ? 'bg-emerald-50 text-emerald-700' : 'animate-attention-pulse bg-amber-50 text-amber-800'
            }`}>
              {copy.eyebrow}
            </div>
          </div>

          <div className="mt-5 lg:hidden">
            <div className="grid grid-cols-2 gap-3">
              {copy.canCheckout ? (
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={isNavigating}
                  className="primary-button min-h-[52px] w-full justify-center px-3 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isNavigating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {isNavigating ? 'Opening…' : copy.ctaLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBack}
                  disabled={isNavigating}
                  className="secondary-button min-h-[52px] w-full justify-center px-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
              )}
              {copy.canCheckout ? (
                <button
                  type="button"
                  onClick={onRetake}
                  disabled={isNavigating}
                  className="secondary-button min-h-[52px] w-full justify-center px-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Retake
                </button>
              ) : null}
            </div>
          </div>

          {!copy.canCheckout && retakeTips.length ? (
            <div className="attention-card mt-5 rounded-[28px] border border-amber-200 bg-amber-50/90 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-amber-700" />
                Let's fix this:
              </div>
              <div className="mt-4 space-y-3">
                {retakeTips.map((item, index) => (
                  <div
                    key={item}
                    className="animate-soft-pop rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {copy.canCheckout && advisoryTips.length ? (
            <div className="mt-5 rounded-[28px] border border-amber-200 bg-amber-50/90 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-amber-700" />
                Background advice
              </div>
              <div className="mt-4 space-y-3">
                {advisoryTips.map((item, index) => (
                  <div
                    key={item}
                    className="animate-soft-pop rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-[28px] bg-slate-50 p-4">
            <div
              className="relative mx-auto overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-inner"
              style={{ aspectRatio: `${result.outputWidth || 600} / ${result.outputHeight || 600}`, maxWidth: '540px' }}
            >
              <ProtectedPhotoPreview
                src={result.processedPhoto}
                alt="Finished passport photo"
                watermarkEnabled={Boolean(result.backgroundRemovalApplied)}
                className="h-full w-full"
              />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          {!copy.canCheckout ? (
            <div className="surface-card attention-card p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-amber-700" />
                For the next selfie
              </div>
              <div className="mt-4 space-y-3">
                {guidanceItems.map((item, index) => (
                  <div
                    key={item}
                    className="animate-soft-pop rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="surface-card p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-blue-600" />
              {copy.canCheckout ? 'Next step' : 'Ready when you are'}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {copy.canCheckout
                ? 'Finish secure checkout to unlock your photo, or retake it if you want a different selfie.'
                : 'Retake the photo and we will build a cleaner version for you.'}
            </p>

            <div className="mt-5 hidden flex-col gap-3 lg:flex">
              {copy.canCheckout ? (
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={isNavigating}
                  className="primary-button w-full justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isNavigating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {isNavigating ? 'Opening checkout…' : copy.ctaLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onRetake}
                disabled={isNavigating}
                className="secondary-button w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCcw className="h-4 w-4" />
                {copy.canCheckout ? 'Retake Photo' : copy.ctaLabel}
              </button>
            </div>
          </div>

          {copy.canCheckout ? (
            <div className="surface-card p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-slate-700" />
                What we handled
              </div>
              <div className="mt-4 space-y-3">
                {guidanceItems.map((item) => (
                  <div key={item} className="animate-fade-up rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      {!copy.canCheckout ? (
        <div className="lg:hidden">
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
            <div className="pointer-events-auto mx-auto flex max-w-[1120px] gap-3 rounded-[24px] border border-slate-200 bg-white/96 p-3 shadow-[0_-10px_40px_-24px_rgba(15,23,42,0.3)] backdrop-blur">
              <button
                type="button"
                onClick={onBack}
                disabled={isNavigating}
                className="secondary-button min-h-[52px] flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onRetake}
                disabled={isNavigating}
                className="primary-button min-h-[52px] flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshCcw className="h-4 w-4" />
                Retake Photo
              </button>
            </div>
          </div>
          <div className="h-24" aria-hidden="true" />
        </div>
      ) : null}
    </FlowShell>
  );
}
