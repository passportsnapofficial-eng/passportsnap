import { ArrowRight, Star } from 'lucide-react';

export function FinalCTA({ onStart }) {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="relative overflow-hidden rounded-3xl bg-blue-600 px-6 py-14 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,rgba(255,255,255,0.12),transparent)]" />
          <div className="pointer-events-none absolute -bottom-8 -right-8 h-48 w-48 rounded-full bg-blue-500/40 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 -top-8 h-48 w-48 rounded-full bg-blue-400/30 blur-3xl" />

          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready in seconds. Accepted everywhere.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-blue-100 sm:text-lg">
              Join 12,000+ people who got their passport photos done at home with PassportSnap.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="h-5 w-5 fill-amber-300 text-amber-300" />
              ))}
              <span className="ml-2 text-sm font-semibold text-white">4.9 / 5 from happy users</span>
            </div>

            <button
              type="button"
              onClick={onStart}
              className="mt-8 inline-flex items-center gap-2.5 rounded-2xl bg-white px-8 py-4 text-base font-bold text-blue-600 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:bg-blue-50 active:translate-y-0 active:scale-[0.98]"
            >
              Take Your Photo Now
              <ArrowRight className="h-5 w-5" />
            </button>

            <p className="mt-4 text-sm text-blue-200">
              No signup required · Instant download · Money-back guarantee
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
