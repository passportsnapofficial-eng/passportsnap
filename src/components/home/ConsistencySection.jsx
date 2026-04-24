import { CheckCircle2, Sparkles } from 'lucide-react';
import { CONSISTENCY_PROMISE_POINTS } from '../../data/siteContent';
import { RevealOnScroll } from './RevealOnScroll';

export function ConsistencySection() {
  return (
    <section
      id="consistency"
      className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(15,23,42,0.03)_0%,rgba(219,234,254,0.5)_100%)] px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="pointer-events-none absolute left-0 top-0 h-64 w-64 rounded-full bg-blue-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-6 sm:gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <RevealOnScroll className="max-w-xl">
          <span className="eyebrow">Consistency</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            One simple flow for every format
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
            PassportSnap keeps the journey predictable from the first upload to the final download.
            The document changes. The experience does not.
          </p>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.22)]">
            <Sparkles className="h-4 w-4 text-blue-600" />
            Built to reduce guesswork before checkout
          </div>
        </RevealOnScroll>

        <RevealOnScroll
          delay={120}
          className="surface-card rounded-[28px] border border-white/70 bg-white/[0.86] p-5 shadow-[0_36px_90px_-58px_rgba(15,23,42,0.4)] backdrop-blur-sm sm:rounded-[34px] sm:p-8"
        >
          <div className="grid gap-3">
            {CONSISTENCY_PROMISE_POINTS.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50/85 px-4 py-3.5 text-sm font-medium text-slate-700 transition duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-slate-300 sm:rounded-[22px] sm:py-4"
                style={{ transitionDelay: `${index * 55}ms` }}
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
