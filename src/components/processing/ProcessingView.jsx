import {
  CheckCircle2,
  Eye,
  Image as ImageIcon,
  LoaderCircle,
  Ruler,
  ScanFace,
  ShieldCheck,
  Sparkles,
  SunMedium,
} from 'lucide-react';
import { VIEWS } from '../../lib/utils/constants';
import { FlowShell } from '../flow/FlowShell';
import { FlagMark } from '../shared/FlagMark';

const STEP_ICONS = {
  'detect-face': ScanFace,
  'set-dimensions': Ruler,
  'check-head-size': ShieldCheck,
  'clean-background': Sparkles,
  'optimize-clarity': SunMedium,
  'check-expression': Eye,
  'prepare-output': ImageIcon,
  'final-quality': CheckCircle2,
};

export function ProcessingView({
  selectedDocument,
  selectedCountry,
  selectedPreset,
  sourcePhoto,
  processingState,
  onBack,
}) {
  const activeKey = processingState.activeStepKey;

  return (
    <FlowShell
      currentView={VIEWS.processing}
      title="Running the automated passport-photo checks"
      description="The processor moves through each preparation stage deliberately so the user can understand what is happening before the final result screen appears."
      onBack={onBack}
      backLabel="Back to capture"
      chip={
        <span className="inline-flex items-center gap-2">
          <FlagMark src={selectedDocument.flagPath} label={selectedCountry} size="sm" />
          {selectedPreset.officialSize || selectedPreset.label}
        </span>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <div className="surface-card overflow-hidden p-5 sm:p-6 animate-fade-up">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Live processing preview</div>
              <div className="mt-1 text-sm text-slate-500">
                Document framing and compliance-style guide overlay
              </div>
            </div>
            <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              {processingState.progress}% complete
            </div>
          </div>

          <div className="mt-6 rounded-[32px] bg-slate-950 p-4">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-900">
              <div className="relative aspect-square">
                {sourcePhoto ? (
                  <img src={sourcePhoto} alt="Source preview" className="h-full w-full object-cover opacity-95" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-300">
                    Preparing preview
                  </div>
                )}

                <div className="absolute inset-[11%] rounded-[28px] border-2 border-white/70" />
                <div className="absolute inset-x-[24%] top-[18%] h-[50%] rounded-[999px] border border-cyan-300/80" />
                <div className="absolute inset-x-[18%] bottom-[17%] h-px bg-white/35" />
                <div className="absolute left-1/2 top-[11%] h-[70%] w-px -translate-x-1/2 bg-white/15" />
                <div className="absolute left-[12%] top-[22%] h-px w-[14%] bg-cyan-300/70" />
                <div className="absolute right-[12%] top-[22%] h-px w-[14%] bg-cyan-300/70" />
                <div
                  className={`absolute left-[16%] top-[18%] h-[50%] w-px ${
                    activeKey === 'check-head-size' ? 'bg-emerald-300 animate-pulse' : 'bg-white/20'
                  }`}
                />
                <div
                  className={`absolute right-[16%] top-[18%] h-[50%] w-px ${
                    activeKey === 'check-head-size' ? 'bg-emerald-300 animate-pulse' : 'bg-white/20'
                  }`}
                />

                <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
                  {selectedPreset.officialSize || selectedPreset.label}
                </div>
                <div className="absolute right-4 top-4 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 backdrop-blur">
                  Automated review
                </div>
                <div className="absolute bottom-4 left-4 right-4 rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 backdrop-blur">
                  Current stage: {processingState.steps.find((step) => step.key === activeKey)?.title || 'Preparing'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Document</div>
                <div className="mt-2 text-sm font-semibold">{selectedDocument.name}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Export</div>
                <div className="mt-2 text-sm font-semibold">
                  {selectedPreset.outputWidth} x {selectedPreset.outputHeight}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Background</div>
                <div className="mt-2 text-sm font-semibold">{selectedPreset.background}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6 sm:p-7 animate-slide-up">
          <div className="text-sm font-semibold text-slate-900">Processing timeline</div>
          <div className="mt-4 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${processingState.progress}%` }}
            />
          </div>

          <div className="mt-6 space-y-3">
            {processingState.steps.map((step) => {
              const Icon = STEP_ICONS[step.key] || ShieldCheck;
              const isComplete = processingState.completedKeys.includes(step.key);
              const isActive = processingState.activeStepKey === step.key;

              return (
                <div
                  key={step.key}
                  className={`rounded-[28px] border p-4 transition ${
                    isComplete
                      ? 'border-emerald-100 bg-emerald-50'
                      : isActive
                        ? 'border-blue-100 bg-blue-50 shadow-[0_22px_54px_-36px_rgba(59,130,246,0.45)]'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl ${
                        isComplete
                          ? 'bg-white text-emerald-600 shadow-sm'
                          : isActive
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isActive ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                        {isComplete ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            Complete
                          </span>
                        ) : null}
                        {isActive ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                            Running
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </FlowShell>
  );
}
