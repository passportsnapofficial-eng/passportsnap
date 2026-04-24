import { Clock3, ScanFace, ShieldCheck } from 'lucide-react';
import { FEATURE_CARDS } from '../../data/siteContent';
import { RevealOnScroll } from './RevealOnScroll';

const CARD_ICONS = [Clock3, ScanFace, ShieldCheck];

export function FeatureCardsSection() {
  return (
    <section className="page-section px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <RevealOnScroll className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">Why PassportSnap</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Clear guidance, faster results, less friction.
          </h2>
        </RevealOnScroll>

        <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5 lg:mt-10">
          {FEATURE_CARDS.map((card, index) => {
            const Icon = CARD_ICONS[index];

            return (
              <RevealOnScroll
                key={card.title}
                delay={index * 90}
                className="surface-card flex h-full flex-col rounded-[28px] p-6 shadow-[0_28px_80px_-54px_rgba(15,23,42,0.36)] motion-safe:hover:-translate-y-1 sm:rounded-[32px] sm:p-7"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 sm:mt-6 sm:text-2xl">
                  {card.title}
                </h3>
                <p className="mt-3 text-[0.98rem] leading-7 text-slate-600 sm:text-base">{card.body}</p>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
