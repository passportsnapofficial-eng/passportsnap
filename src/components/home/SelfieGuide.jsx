import { CheckCircle2 } from 'lucide-react';
import { SELFIE_TIPS } from '../../data/siteContent';
import { BeforeAfterPreview } from './BeforeAfterPreview';
import { RevealOnScroll } from './RevealOnScroll';

export function SelfieGuide({ onStart }) {
  return (
    <section id="selfie-guide" className="scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <RevealOnScroll className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Selfie guidance</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Start with a compliant passport selfie
          </h2>
        </RevealOnScroll>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8">
          <RevealOnScroll delay={60}>
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)]">
              <div className="px-6 pt-6 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Take a selfie like this</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Follow these tips for the best result
                </p>
              </div>

              <div className="relative mx-6 mb-0 overflow-hidden rounded-2xl bg-slate-50">
                <div className="relative flex justify-center py-4">
                  <div className="relative h-[200px] w-[150px] overflow-hidden rounded-xl">
                    <img
                      src="/home-preview/passportsnap-woman-before.webp"
                      alt="Good selfie example"
                      className="h-full w-full object-cover object-top"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-36 w-28 rounded-full border-[3px] border-blue-400/70 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-6">
                {SELFIE_TIPS.map((tip) => (
                  <div key={tip} className="flex items-center gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={120}>
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)]">
              <div className="px-6 pt-6 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  From selfie to passport-ready format
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  PassportSnap formats the crop, size, and background for review
                </p>
              </div>

              <div className="flex-1 px-6 pb-6">
                <BeforeAfterPreview variant="hero" showLabels />

                <button
                  type="button"
                  onClick={onStart}
                  className="mt-5 w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(37,99,235,0.4)] transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0"
                >
                  Try it with your photo
                </button>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
