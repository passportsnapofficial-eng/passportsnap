import { ArrowRight, Camera, Clock3, Sparkles, Upload } from 'lucide-react';
import { formatCurrency } from '../../lib/utils/formatters';
import { VIEWS } from '../../lib/utils/constants';
import { FlagMark } from '../shared/FlagMark';
import { FlowShell } from './FlowShell';

function ModeButton({ label, icon, active, onClick }) {
  const IconComponent = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
        active ? 'bg-slate-950 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100'
      }`}
    >
      <IconComponent className="h-4 w-4" />
      {label}
    </button>
  );
}

export function DocumentSelectionView({
  documents,
  selectedDocument,
  preferredCaptureMode,
  onChangeMode,
  onSelectDocument,
  onContinue,
  onBackHome,
}) {
  const selectedAvailable = selectedDocument.status === 'available';

  return (
    <FlowShell
      currentView={VIEWS.document}
      title="Choose the document you want to prepare"
      description="Start by selecting the document type. Every listed country format below runs through the same guided capture, processing, results, checkout, and download flow."
      onBack={onBackHome}
      backLabel="Back to home"
      chip="Step 1 of 6"
    >
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <div className="surface-card p-5 sm:p-6 animate-fade-up">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Preferred source</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Set the next step before you continue. You can still switch this again on the
                  capture screen.
                </p>
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <ModeButton
                  label="Take photo"
                  icon={Camera}
                  active={preferredCaptureMode === 'camera'}
                  onClick={() => onChangeMode('camera')}
                />
                <ModeButton
                  label="Upload photo"
                  icon={Upload}
                  active={preferredCaptureMode === 'upload'}
                  onClick={() => onChangeMode('upload')}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {documents.map((document, index) => {
                const isSelected = document.id === selectedDocument.id;
                const isAvailable = document.status === 'available';

                return (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => onSelectDocument(document.id)}
                    className={`rounded-[30px] border p-5 text-left transition duration-300 motion-safe:hover:-translate-y-1 animate-fade-up ${
                      isSelected
                        ? 'border-blue-300 bg-blue-50 shadow-[0_24px_60px_-36px_rgba(59,130,246,0.45)]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-4">
                        <FlagMark src={document.flagPath} label={document.countryLabel} size="lg" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-slate-900">{document.name}</div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isAvailable
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {isAvailable ? 'Active now' : 'Coming soon'}
                            </span>
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-600">{document.description}</div>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <div className="text-lg font-semibold text-slate-900">
                          {formatCurrency(document.price)}
                        </div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {document.officialSizeLabel}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Background
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {document.backgroundLabel}
                        </div>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Reference
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {document.sourceLabel}
                        </div>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Requirement
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {document.trustLabel}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="surface-card p-6 sm:p-7 animate-slide-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Guided start
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-900">Selected document summary</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Review the published size, background requirement, and source reference before moving
            into capture. You can switch the input method now and change it again on the next
            screen if needed.
          </p>

          <div className="mt-6 rounded-[32px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <FlagMark src={selectedDocument.flagPath} label={selectedDocument.countryLabel} size="lg" />
              <div>
                <div className="text-lg font-semibold text-slate-900">{selectedDocument.name}</div>
                <div className="text-sm text-slate-500">{selectedDocument.authority}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {selectedDocument.requirements.slice(0, 4).map((item) => (
                <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {item.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Automated first-pass review</div>
                <div className="mt-1 text-sm leading-6 text-slate-500">
                  The processor handles size, white background, export, and compliance-style checks.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Fast next step</div>
                <div className="mt-1 text-sm leading-6 text-slate-500">
                  {selectedAvailable
                    ? `Continue with ${preferredCaptureMode === 'camera' ? 'camera capture' : 'photo upload'} next.`
                    : 'This format is still in preview and cannot continue yet.'}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onContinue}
            disabled={!selectedAvailable}
            className="primary-button mt-8 w-full justify-between"
          >
            <span>
              {selectedAvailable
                ? `Continue with ${preferredCaptureMode === 'camera' ? 'camera' : 'upload'}`
                : 'Preview only'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
          {!selectedAvailable ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This format is not active yet.
            </p>
          ) : null}
        </aside>
      </div>
    </FlowShell>
  );
}
