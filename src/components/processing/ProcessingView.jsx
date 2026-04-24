import { AlertCircle, CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react';
import { CAPTURE_MODES, VIEWS } from '../../lib/utils/constants';
import { FlowShell } from '../flow/FlowShell';

const FRIENDLY_STEPS = [
  {
    label: 'Lining up your face',
    keys: ['load-source', 'detect-face', 'validate-face'],
  },
  {
    label: 'Cleaning up the background',
    keys: ['segment-background', 'remove-background', 'build-canvas'],
  },
  {
    label: 'Finishing your photo',
    keys: ['analyze-lighting', 'detect-blur', 'check-output', 'finalize-result'],
  },
];

function getFriendlyStatus(stepKeys, processingState) {
  if (processingState.status === 'error') {
    return 'pending';
  }

  if (stepKeys.every((key) => processingState.completedKeys.includes(key))) {
    return 'complete';
  }

  if (stepKeys.includes(processingState.activeStepKey)) {
    return 'active';
  }

  return 'pending';
}

function FriendlyStep({ label, status, style }) {
  const icon =
    status === 'complete' ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
    ) : status === 'active' ? (
      <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
    ) : (
      <div className="h-5 w-5 rounded-full border border-slate-300 bg-white" />
    );

  return (
    <div
      style={style}
      className={`animate-fade-up flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
      status === 'active'
        ? 'border-blue-200 bg-blue-50'
        : status === 'complete'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white'
    }`}
    >
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      {icon}
    </div>
  );
}

export function ProcessingView({
  selectedDocument,
  selectedCountry,
  selectedPreset,
  captureMode,
  sourcePhoto,
  processingState,
  onBack,
}) {
  const isError = processingState.status === 'error';
  const rejectionReasons = Array.isArray(processingState.rejectionReasons)
    ? processingState.rejectionReasons.filter(Boolean).slice(0, 5)
    : [];

  return (
    <FlowShell
      currentView={VIEWS.processing}
      title="We’ll handle the rest"
      description="Give us a moment to clean up your selfie and get it ready."
      onBack={onBack}
      backLabel="Back to photo"
      chip="Step 3 of 4"
      compactHeader
      summaryItems={[
        { label: 'Document', value: selectedCountry },
        { label: 'Format', value: selectedPreset.officialSize || selectedPreset.label },
        { label: 'Source', value: captureMode === CAPTURE_MODES.camera ? 'Selfie' : 'Upload' },
      ]}
    >
      <div className="workspace-grid">
        <section className="workspace-main">
          <div className="workspace-panel">
            <div className="rounded-[28px] bg-slate-950 p-4">
              <div
                className="relative mx-auto w-full max-w-[430px] overflow-hidden rounded-[24px] border border-white/10 bg-slate-900"
                style={{ aspectRatio: '3 / 4' }}
              >
                {sourcePhoto ? (
                  <img src={sourcePhoto} alt="Selfie being processed" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-300">
                    Getting your photo ready
                  </div>
                )}
                <div className="absolute inset-x-4 bottom-4 rounded-[20px] bg-slate-950/82 px-4 py-3 text-sm text-white backdrop-blur">
                  {isError ? 'We need one more photo to finish this.' : 'Working on your photo now.'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="workspace-side">
          <div className="workspace-panel">
            {isError ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <div className="text-sm font-semibold text-amber-900">Let’s fix this</div>
                    {rejectionReasons.length ? (
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900/80">
                        {rejectionReasons.map((reason) => (
                          <li key={reason} className="flex gap-2">
                            <span aria-hidden="true">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm leading-6 text-amber-900/80">
                        {processingState.message || 'We could not finish this photo. Take one more and we will try again.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-fade-up rounded-[24px] bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Getting it ready
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Sit tight for a moment. We are polishing the crop, background, and final look.
                </p>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {FRIENDLY_STEPS.map((step, index) => (
                <FriendlyStep
                  key={step.label}
                  label={step.label}
                  status={getFriendlyStatus(step.keys, processingState)}
                  style={{ animationDelay: `${index * 80}ms` }}
                />
              ))}
            </div>

            <div className="workspace-footer">
              <button type="button" onClick={onBack} className="secondary-button w-full justify-center">
                {isError ? 'Retake Photo' : 'Back'}
              </button>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected document</div>
              <div className="mt-3 text-sm font-semibold text-slate-900">{selectedDocument.name}</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                We are shaping this for {selectedDocument.countryLabel} while you wait.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </FlowShell>
  );
}
