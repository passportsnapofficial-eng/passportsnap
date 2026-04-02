import { ArrowRight, Camera, CheckCircle2, ShieldCheck, Upload } from 'lucide-react';
import { ACTIVE_DOCUMENT } from '../../data/documentTypes';
import { HERO_STATS, HERO_TRUST_ITEMS } from '../../data/siteContent';
import { FlagMark } from '../shared/FlagMark';

export function HeroSection({ onStartCamera, onStartUpload }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.35),_transparent_36%),radial-gradient(circle_at_left_center,_rgba(14,165,233,0.18),_transparent_24%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-18 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-100">
            <ShieldCheck className="h-4 w-4" />
            Guided automated passport-photo workflow
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Take or upload a photo.
            <br />
            The app formats it for passport requirements.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Choose a country format, review the draft, watch the automated checks run, and move
            through a clear six-step funnel to checkout and downloads.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <button type="button" onClick={onStartCamera} className="primary-button text-base">
              <Camera className="h-5 w-5" />
              Take photo now
            </button>
            <button type="button" onClick={onStartUpload} className="secondary-button text-base">
              <Upload className="h-5 w-5" />
              Upload existing photo
            </button>
          </div>

          <div className="mt-8 flex flex-col gap-3 text-sm text-slate-200 sm:flex-row sm:flex-wrap">
            {HERO_TRUST_ITEMS.map((item) => (
              <div
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 animate-soft-pop"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {HERO_STATS.map((item) => (
              <div key={item.label} className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {item.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-scale-in">
          <div className="absolute -right-8 top-10 hidden h-40 w-40 rounded-full bg-blue-500/20 blur-3xl lg:block" />
          <div className="absolute -left-6 bottom-4 hidden h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl lg:block" />

          <div className="relative mx-auto max-w-[520px]">
            <div className="absolute -left-3 top-10 z-20 rounded-[24px] border border-white/10 bg-slate-900/90 px-4 py-3 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.7)] backdrop-blur animate-float">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Featured example</div>
              <div className="mt-1 text-sm font-semibold text-white">{ACTIVE_DOCUMENT.name}</div>
            </div>

            <div className="absolute -right-1 top-28 z-20 rounded-[24px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 shadow-[0_24px_60px_-36px_rgba(16,185,129,0.55)] backdrop-blur animate-float-delayed">
              <div className="text-xs uppercase tracking-[0.16em] text-emerald-200">Coverage</div>
              <div className="mt-1 text-sm font-semibold text-white">All listed formats active</div>
            </div>

            <div className="absolute left-8 top-[62%] z-20 hidden rounded-[24px] border border-white/10 bg-slate-900/90 px-4 py-3 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.7)] backdrop-blur sm:block animate-float-slow">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Flow</div>
              <div className="mt-1 text-sm font-semibold text-white">Choose country next</div>
            </div>

            <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-white/95 p-4 shadow-[0_48px_120px_-48px_rgba(15,23,42,0.8)]">
              <div className="flex items-center justify-between rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FlagMark src={ACTIVE_DOCUMENT.flagPath} label={ACTIVE_DOCUMENT.countryLabel} size="lg" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{ACTIVE_DOCUMENT.countryLabel}</div>
                    <div className="text-xs text-slate-500">{ACTIVE_DOCUMENT.authority}</div>
                  </div>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Supported now
                </div>
              </div>

              <div className="mt-4 rounded-[32px] bg-slate-100 p-4">
                <div className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white">
                  <div className="relative aspect-square bg-white p-4">
                    <img
                      src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80"
                      alt="Passport photo preview"
                      className="h-full w-full rounded-[20px] object-cover"
                    />
                    <div className="pointer-events-none absolute inset-[12%] rounded-[24px] border border-slate-300/80" />
                    <div className="pointer-events-none absolute inset-x-[30%] top-[18%] h-[54%] rounded-[999px] border border-blue-300/65" />
                    <div className="pointer-events-none absolute left-1/2 top-[12%] h-[68%] w-px -translate-x-1/2 bg-slate-300/60" />
                    <div className="pointer-events-none absolute inset-x-[22%] bottom-[20%] h-px bg-slate-300/60" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Document</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">Featured example</div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Output</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {ACTIVE_DOCUMENT.officialSizeLabel}
                  </div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Flow</div>
                  <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                    Choose country next
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
