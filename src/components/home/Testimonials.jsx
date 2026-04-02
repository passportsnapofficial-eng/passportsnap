import { Star } from 'lucide-react';
import { TESTIMONIALS } from '../../data/siteContent';

export function Testimonials() {
  return (
    <section id="reviews" className="scroll-mt-28 bg-slate-50 py-18 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="eyebrow">Reviews</span>
          <h2 className="section-title mt-4">
            Stronger feedback framing for a product that feels more guided and credible.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-3">
          {TESTIMONIALS.map((item, index) => (
            <article
              key={item.id}
              className="surface-card flex h-full flex-col p-6 animate-fade-up"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-700">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                  <div className="text-sm text-slate-500">{item.location}</div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <Star key={`${item.id}-${starIndex}`} className="h-4 w-4 fill-current" />
                ))}
              </div>

              <p className="mt-5 flex-1 text-base leading-8 text-slate-700">"{item.quote}"</p>
              <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.context}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
