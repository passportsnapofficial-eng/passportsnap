import { Star } from 'lucide-react';
import { TRUST_STRIP_POINTS } from '../../data/siteContent';

export function TrustStrip() {
  return (
    <section className="relative z-10 -mt-14 px-4 pb-10 sm:-mt-20 sm:px-6 sm:pb-14">
      <div className="mx-auto max-w-[1120px]">
        <div className="surface-card border-white/50 bg-white/[0.88] p-5 shadow-[0_34px_90px_-52px_rgba(15,23,42,0.3)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                <Star className="h-4 w-4 fill-current text-amber-300" />
                Trusted by customers who want a simple at-home passport photo
              </div>
              <p className="mt-4 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                No editor mindset. No technical setup. Just a clean guided flow.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[32rem]">
              {TRUST_STRIP_POINTS.map((point) => (
                <div key={point} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
