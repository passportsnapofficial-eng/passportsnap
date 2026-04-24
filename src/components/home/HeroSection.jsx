import { ArrowRight, CheckCircle2, ShieldCheck, Star } from 'lucide-react';
import { HERO_BADGES } from '../../data/siteContent';

export function HeroSection({ onStart }) {
  return (
    <section className="relative overflow-hidden bg-transparent pt-[var(--app-nav-height)] text-white">
      <div className="absolute left-[-6rem] top-10 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute right-[-5rem] top-20 h-64 w-64 rounded-full bg-blue-400/18 blur-3xl" />

      <div className="relative mx-auto grid max-w-[1120px] gap-10 px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center lg:gap-12 lg:pt-24">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 shadow-[0_18px_40px_-32px_rgba(2,8,23,0.56)] backdrop-blur-md">
            <ShieldCheck className="h-4 w-4" />
            Premium passport photo service
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Take your passport photo in seconds
          </h1>

          <p className="mt-5 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">
            Upload a photo or take a selfie instantly. We handle sizing, cropping, compliance, and background.
          </p>

          <div className="mt-8">
            <button
              type="button"
              onClick={onStart}
              className="primary-button min-h-[60px] w-full justify-center px-7 text-base sm:w-auto sm:min-w-[220px]"
            >
              <span>Start Photo</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {HERO_BADGES.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 backdrop-blur-sm"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.06] p-4 shadow-[0_38px_100px_-56px_rgba(2,8,23,0.86)] backdrop-blur-md sm:p-5">
          <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.08)_100%)] p-4">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_30px_70px_-56px_rgba(15,23,42,0.34)]">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">
                <Star className="h-4 w-4 fill-current" />
                4.9/5 from happy customers
              </div>

              <div className="mt-5 rounded-[22px] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">What you get</div>
                <div className="mt-3 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    Passport sizing handled automatically
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    White background cleaned in one pass
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    Download-ready JPG without manual editing
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] bg-slate-950 px-5 py-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Product promise</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Take a selfie, let the system do the work, and download your finished passport photo when it is ready.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
