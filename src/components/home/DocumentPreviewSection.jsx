import { DOCUMENT_TYPES } from '../../data/documentTypes';
import { FlagMark } from '../shared/FlagMark';
import { RevealOnScroll } from './RevealOnScroll';

export function DocumentPreviewSection() {
  const featuredDocuments = DOCUMENT_TYPES.filter((document) => document.status === 'available').slice(0, 4);
  const additionalCount = Math.max(DOCUMENT_TYPES.length - featuredDocuments.length, 0);

  return (
    <section id="documents" className="page-section scroll-mt-28 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <RevealOnScroll className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">Supported documents</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Supported document formats
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
            Use one clean product flow across passport and visa photo sizes without re-learning the process.
          </p>
        </RevealOnScroll>

        <div className="mt-8 grid gap-4 md:mt-10 md:grid-cols-2 md:gap-5">
          {featuredDocuments.map((document, index) => (
            <RevealOnScroll
              key={document.id}
              delay={index * 80}
              className="surface-card flex h-full flex-col rounded-[26px] p-5 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.34)] motion-safe:hover:-translate-y-1 sm:rounded-[30px] sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <FlagMark src={document.flagPath} label={document.countryLabel} size="lg" />
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-slate-900">{document.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{document.countryLabel}</div>
                  </div>
                </div>
                <div className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {document.officialSizeLabel}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:mt-6">
                {[document.backgroundLabel, document.trustLabel].map((item) => (
                  <div
                    key={`${document.id}-${item}`}
                    className="rounded-[20px] border border-slate-200 bg-slate-50/85 px-4 py-3.5 text-sm font-medium text-slate-700 sm:rounded-[22px] sm:py-4"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </RevealOnScroll>
          ))}
        </div>

        {additionalCount ? (
          <RevealOnScroll
            delay={180}
            className="mx-auto mt-7 max-w-3xl rounded-[24px] border border-slate-200 bg-white/[0.85] px-5 py-4 text-center text-sm leading-7 text-slate-600 shadow-[0_26px_70px_-54px_rgba(15,23,42,0.28)] sm:mt-8 sm:rounded-[28px] sm:px-6 sm:py-5"
          >
            More document formats are available inside document selection when you start your photo.
          </RevealOnScroll>
        ) : null}
      </div>
    </section>
  );
}
