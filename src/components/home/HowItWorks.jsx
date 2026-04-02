import { Camera, CheckSquare, ShieldCheck, ShoppingBag } from 'lucide-react';
import { HOW_IT_WORKS_STEPS } from '../../data/siteContent';

const STEP_ICONS = [Camera, CheckSquare, ShieldCheck, ShoppingBag];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-28 bg-slate-950 py-18 text-white sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
            How it works
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            A guided product funnel instead of a flat one-page editor.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
            Every step has a clear purpose, clear feedback, and a stronger sense of progression.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const Icon = STEP_ICONS[index];

            return (
              <article
                key={step.title}
                className="relative rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.9)] animate-fade-up"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-950">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Step {index + 1}
                </div>
                <h3 className="mt-2 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{step.description}</p>
                {index < HOW_IT_WORKS_STEPS.length - 1 ? (
                  <div className="absolute right-[-18px] top-1/2 hidden h-px w-9 bg-white/20 lg:block" />
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
