import { Camera, Download, FileBadge2, Sparkles } from 'lucide-react';
import { HOW_IT_WORKS_STEPS } from '../../data/siteContent';
import { RevealOnScroll } from './RevealOnScroll';

const STEP_ICONS = [FileBadge2, Camera, Sparkles, Download];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="page-section scroll-mt-28 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <RevealOnScroll className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Simple process. Clean results.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            A focused four-step flow that keeps the product fast, clear, and easy to trust on any device.
          </p>
        </RevealOnScroll>

        <div className="relative mt-10 grid gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-4">
          <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-10 hidden h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent lg:block" />

          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const Icon = STEP_ICONS[index];

            return (
              <RevealOnScroll
                key={step.title}
                delay={index * 90}
                className="relative flex h-full flex-col rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_-56px_rgba(15,23,42,0.36)] transition duration-300 motion-safe:hover:-translate-y-1 sm:rounded-[30px] sm:p-6"
              >
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Step {index + 1}
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{step.title}</h3>
                <p className="mt-3 text-[0.98rem] leading-7 text-slate-600 sm:text-base">{step.description}</p>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
