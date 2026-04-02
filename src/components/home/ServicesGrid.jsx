import { ArrowRight, Camera, Clock3, Upload } from 'lucide-react';
import { formatCurrency } from '../../lib/utils/formatters';
import { FlagMark } from '../shared/FlagMark';

export function ServicesGrid({ documents, onStartFlow }) {
  return (
    <section id="pricing" className="scroll-mt-28 py-18 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="eyebrow">Document types</span>
          <h2 className="section-title mt-4">Choose from every active country format in the product.</h2>
          <p className="section-copy mt-4">
            Each card below can enter the same guided flow, with country-specific dimensions,
            background targets, automated checks, checkout, and download delivery.
          </p>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-3">
          {documents.map((document, index) => {
            const isAvailable = document.status === 'available';

            return (
              <article
                key={document.id}
                className={`surface-card flex h-full flex-col p-6 transition duration-300 motion-safe:hover:-translate-y-1 animate-fade-up ${
                  isAvailable ? '' : 'opacity-95'
                }`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <FlagMark src={document.flagPath} label={document.countryLabel} size="lg" />
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{document.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{document.authority}</div>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {isAvailable ? 'Active now' : 'Coming soon'}
                  </span>
                </div>

                <div className="mt-6 flex items-baseline justify-between gap-3">
                  <div className="text-3xl font-semibold text-slate-900">
                    {formatCurrency(document.price)}
                  </div>
                  <div className="text-sm text-slate-500">{document.officialSizeLabel}</div>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-600">{document.description}</p>

                <div className="mt-6 grid gap-3">
                  <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Background requirement
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{document.backgroundLabel}</div>
                  </div>
                  <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Source / reference
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{document.sourceLabel}</div>
                  </div>
                  <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Snapshot
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {document.requirementSummary}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  {isAvailable ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onStartFlow('camera', document)}
                        className="primary-button w-full justify-between"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          Start with camera
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartFlow('upload', document)}
                        className="secondary-button w-full justify-between"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Start with upload
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-4">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <Clock3 className="h-4 w-4" />
                        Preview product card
                      </div>
                      <p className="mt-2 text-sm leading-6 text-amber-900/80">
                        This format stays visible as a preview until the workflow is enabled.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
