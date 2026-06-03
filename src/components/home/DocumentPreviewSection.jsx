import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe, Lock, ShieldCheck, Sun, User, Zap } from 'lucide-react';
import { DOCUMENT_TYPES } from '../../data/documentTypes';
import { FlagMark } from '../shared/FlagMark';
import { RevealOnScroll } from './RevealOnScroll';

const CARD_PALETTES = [
  { header: 'bg-blue-50/60', chip: 'bg-blue-100 text-blue-700' },
  { header: 'bg-rose-50/60', chip: 'bg-rose-100 text-rose-700' },
  { header: 'bg-emerald-50/60', chip: 'bg-emerald-100 text-emerald-700' },
  { header: 'bg-violet-50/60', chip: 'bg-violet-100 text-violet-700' },
  { header: 'bg-amber-50/60', chip: 'bg-amber-100 text-amber-700' },
  { header: 'bg-sky-50/60', chip: 'bg-sky-100 text-sky-700' },
  { header: 'bg-indigo-50/60', chip: 'bg-indigo-100 text-indigo-700' },
  { header: 'bg-pink-50/60', chip: 'bg-pink-100 text-pink-700' },
];

function IcaoCompliantIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 3.25 19 6.1v5.25c0 4.25-2.85 7.95-7 9.4-4.15-1.45-7-5.15-7-9.4V6.1l7-2.85Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m8.25 12.1 2.35 2.35 5.15-5.35"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.4 6.95h7.2M7.2 9.3h9.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}

const TRUST_ITEMS = [
  { Icon: IcaoCompliantIcon, title: 'ICAO compliant', body: 'Built-in checks for passport photo standards' },
  { Icon: Globe, title: 'Global coverage', body: 'Passports, visas & ID photos worldwide' },
  { Icon: Zap, title: 'Instant validation', body: 'Real-time checks before you download' },
  { Icon: Lock, title: 'Secure & private', body: 'Your photos and data are protected' },
];

const AVAILABLE_FORMATS = DOCUMENT_TYPES.filter((d) => d.status === 'available');

function DocumentCard({ doc, index }) {
  const palette = CARD_PALETTES[index % CARD_PALETTES.length];

  return (
    <div className="snap-panel flex-none w-[82%] min-w-[252px] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]">
      <article className="flex h-full flex-col overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[0_16px_48px_-16px_rgba(15,23,42,0.16)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_64px_-20px_rgba(15,23,42,0.26)]">
        {/* Pastel header */}
        <div className={`${palette.header} flex items-start justify-between gap-3 px-5 pb-4 pt-5`}>
          <FlagMark src={doc.flagPath} label={doc.countryLabel} size="lg" />
          <span className={`${palette.chip} shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold leading-5`}>
            {doc.officialSizeLabel}
          </span>
        </div>

        {/* Card body */}
        <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
          <p className="text-[17px] font-semibold leading-snug text-slate-900">{doc.name}</p>
          <p className="mt-0.5 text-sm text-slate-500">{doc.countryLabel}</p>

          <div className="mt-4 flex flex-col gap-2">
            {doc.backgroundLabel && (
              <div className="flex items-center gap-2.5 rounded-[14px] border border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
                <Sun size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span className="text-xs font-medium text-slate-700">{doc.backgroundLabel}</span>
              </div>
            )}
            {doc.trustLabel && (
              <div className="flex items-center gap-2.5 rounded-[14px] border border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
                <User size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span className="text-xs font-medium text-slate-700">{doc.trustLabel}</span>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

export function DocumentPreviewSection() {
  const scrollRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(AVAILABLE_FORMATS.length > 1);

  const syncState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cards = Array.from(el.children);
    let minDist = Infinity;
    let closest = 0;
    cards.forEach((card, i) => {
      const dist = Math.abs(card.offsetLeft - scrollLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActiveIdx(closest);
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', syncState, { passive: true });
    const frame = requestAnimationFrame(syncState);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', syncState);
    };
  }, [syncState]);

  const scrollToCard = useCallback((idx) => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = Array.from(el.children);
    const target = cards[Math.max(0, Math.min(idx, cards.length - 1))];
    if (target) el.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
  }, []);

  const goPrev = useCallback(() => scrollToCard(activeIdx - 1), [activeIdx, scrollToCard]);
  const goNext = useCallback(() => scrollToCard(activeIdx + 1), [activeIdx, scrollToCard]);

  return (
    <section id="documents" className="page-section scroll-mt-28 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <RevealOnScroll className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">Supported documents</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Supported document formats
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
            Use one simple flow across passport, visa, and ID photo sizes without re-learning the process.
          </p>
        </RevealOnScroll>

        {/* Trust badges + CTA row */}
        <RevealOnScroll
          delay={60}
          className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 sm:justify-start">
            <span className="flex items-center gap-1.5 text-sm text-slate-600">
              <ShieldCheck size={15} className="text-blue-500" aria-hidden="true" />
              60+ formats supported
            </span>
            <span className="hidden text-slate-300 sm:block" aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5 text-sm text-slate-600">
              <Globe size={15} className="text-blue-500" aria-hidden="true" />
              ICAO compliance built in
            </span>
          </div>
          <a
            href="/document"
            className="flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-700 sm:shrink-0"
          >
            See all 60+ formats
            <ChevronRight size={14} aria-hidden="true" />
          </a>
        </RevealOnScroll>

        {/* Carousel */}
        <RevealOnScroll delay={100} className="relative mt-8">
          {/* Prev arrow */}
          <button
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Show previous formats"
            className="absolute -left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_4px_18px_-4px_rgba(15,23,42,0.18)] transition duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.22)] disabled:pointer-events-none disabled:opacity-40 sm:flex lg:-left-6 lg:h-12 lg:w-12"
          >
            <ChevronLeft size={18} className="text-slate-700" />
          </button>

          {/* Scroll track */}
          <div ref={scrollRef} className="snap-strip gap-4">
            {AVAILABLE_FORMATS.map((doc, i) => (
              <DocumentCard key={doc.id} doc={doc} index={i} />
            ))}
          </div>

          {/* Next arrow */}
          <button
            onClick={goNext}
            disabled={!canNext}
            aria-label="Show next formats"
            className="absolute -right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_4px_18px_-4px_rgba(15,23,42,0.18)] transition duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.22)] disabled:pointer-events-none disabled:opacity-40 sm:flex lg:-right-6 lg:h-12 lg:w-12"
          >
            <ChevronRight size={18} className="text-slate-700" />
          </button>
        </RevealOnScroll>

        {/* Pagination dots */}
        <RevealOnScroll delay={140}>
          <div
            className="mt-5 flex justify-center gap-1.5"
            role="tablist"
            aria-label="Document formats"
          >
            {AVAILABLE_FORMATS.map((doc, i) => (
              <button
                key={doc.id}
                role="tab"
                aria-selected={i === activeIdx}
                aria-label={`Jump to ${doc.name}`}
                onClick={() => scrollToCard(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeIdx
                    ? 'w-6 bg-blue-600'
                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        </RevealOnScroll>

        {/* Feature strip */}
        <RevealOnScroll delay={180} className="mt-10 sm:mt-12">
          <div className="grid gap-5 rounded-[26px] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-[0_16px_52px_-22px_rgba(15,23,42,0.13)] sm:grid-cols-2 sm:px-8 sm:py-7 lg:grid-cols-4">
            {TRUST_ITEMS.map(({ Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
                  {createElement(Icon, { size: 16, className: 'text-blue-600', 'aria-hidden': 'true' })}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
