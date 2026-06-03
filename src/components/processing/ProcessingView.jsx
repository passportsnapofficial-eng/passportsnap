import { AlertCircle, CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react';
import { CAPTURE_MODES, VIEWS } from '../../lib/utils/constants';
import { FlowShell } from '../flow/FlowShell';
import { HeadGuideOverlay } from '../capture/HeadGuideOverlay';

const SUMMARY_STEPS = [
  {
    label: 'Lining up your face',
    description: 'Opening the photo, finding your face, and checking the pose.',
    keys: ['load-source', 'detect-face', 'validate-face'],
  },
  {
    label: 'Cleaning the background',
    description: 'Reviewing the backdrop and applying background cleanup.',
    keys: ['segment-background', 'remove-background'],
  },
  {
    label: 'Finishing your photo',
    description: 'Checking quality, building the export, and wrapping up.',
    keys: ['analyze-lighting', 'detect-blur', 'build-canvas', 'check-output', 'finalize-result'],
  },
];

function getStepStatus(stepKeys, processingState) {
  if (processingState.status === 'error') {
    return 'pending';
  }

  if (stepKeys.every((stepKey) => processingState.completedKeys.includes(stepKey))) {
    return 'complete';
  }

  if (stepKeys.includes(processingState.activeStepKey)) {
    return 'active';
  }

  return 'pending';
}

function getActiveStep(steps, processingState) {
  return steps.find((step) => step.key === processingState.activeStepKey) || null;
}

function ProcessingStageRow({ label, description, status, style }) {
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
      className={`animate-fade-up flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 ${
        status === 'active'
          ? 'border-blue-200 bg-blue-50'
          : status === 'complete'
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-slate-200 bg-white'
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-xs leading-5 text-slate-600">{description}</div>
      </div>
      <div className="shrink-0">{icon}</div>
    </div>
  );
}

function ProcessingStages({ steps, processingState, compact = false }) {
  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {steps.map((step, index) => (
        <ProcessingStageRow
          key={step.label}
          label={step.label}
          description={step.description}
          status={getStepStatus(step.keys, processingState)}
          style={{ animationDelay: `${index * 70}ms` }}
        />
      ))}
    </div>
  );
}

function MobileProcessingPopup({ processingState, activeStep }) {
  if (processingState.status === 'error') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-5 lg:hidden">
      <div className="animate-slide-up w-full max-w-[280px] rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" />
              Processing your photo
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {processingState.message || activeStep?.description || 'Getting everything ready now.'}
            </p>
          </div>
          <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {Math.max(4, processingState.progress || 0)}%
          </div>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#38bdf8_100%)] transition-[width] duration-300"
            style={{ width: `${Math.max(4, processingState.progress || 0)}%` }}
          />
        </div>
      </div>
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
  const activeStep = getActiveStep(processingState.steps || [], processingState);

  return (
    <>
      <FlowShell
        currentView={VIEWS.processing}
        title="We'll handle the rest"
        description="Give us a moment to prepare your selfie and get it ready."
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
                    <>
                      <img src={sourcePhoto} alt="Selfie being processed" className="h-full w-full object-cover" />
                      <HeadGuideOverlay />
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-300">
                      Getting your photo ready
                    </div>
                  )}
                  <div className="absolute inset-x-4 bottom-4 rounded-[20px] bg-slate-950/82 px-4 py-3 text-sm text-white backdrop-blur">
                    {isError
                      ? 'We need one more photo to finish this.'
                      : processingState.message || activeStep?.description || 'Working on your photo now.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="workspace-panel lg:hidden">
              {isError ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div>
                      <div className="text-sm font-semibold text-amber-900">Let's fix this</div>
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
              ) : null}
            </div>
          </section>

          <aside className="workspace-side hidden lg:flex">
            <div className="workspace-panel">
              {isError ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div>
                      <div className="text-sm font-semibold text-amber-900">Let's fix this</div>
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
                    Processing live
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {processingState.message || activeStep?.description || 'We are checking the framing and finishing the export.'}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#38bdf8_100%)] transition-[width] duration-300"
                      style={{ width: `${Math.max(4, processingState.progress || 0)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4">
                <ProcessingStages steps={SUMMARY_STEPS} processingState={processingState} />
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

      <MobileProcessingPopup processingState={processingState} activeStep={activeStep} />
    </>
  );
}
