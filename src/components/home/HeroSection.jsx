import { Camera, CheckCircle2, Download, FileBadge2, Lock, Upload, Zap } from 'lucide-react';
import { HERO_BADGES } from '../../data/siteContent';
import { BeforeAfterPreview } from './BeforeAfterPreview';

const BADGE_ICONS = [Zap, CheckCircle2, Download, Lock];

const CARD_FEATURES = [
  'Smart cropping',
  'Background check',
  'Size & alignment',
  'Compliance check',
];

export function HeroSection({ onStart, onUpload }) {
  return (
    <section className="relative overflow-hidden pt-[var(--app-nav-height)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(219,234,254,0.6),transparent)]" />

      <div className="relative mx-auto grid max-w-[1120px] gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:items-center lg:gap-14 lg:pb-24 lg:pt-20">

        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            <FileBadge2 className="h-3.5 w-3.5" />
            Passport photo service
          </div>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Passport photo made
            <span className="block bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
              effortless.
            </span>
            Done in seconds.
          </h1>

          <p className="mt-5 max-w-lg text-base leading-8 text-slate-600 sm:text-lg">
            Take a selfie, then get a correctly sized passport photo with guided crop,
            background, and compliance checks.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => onStart('camera')}
              className="inline-flex min-h-[56px] items-center justify-center gap-2.5 rounded-2xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-[0_8px_32px_-8px_rgba(37,99,235,0.5)] transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 active:scale-[0.98] sm:flex-1 sm:min-w-0"
            >
              <Camera className="h-5 w-5" />
              Take a Selfie
            </button>
            <button
              type="button"
              onClick={() => onStart('upload')}
              className="inline-flex min-h-[56px] items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-800 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 active:translate-y-0 active:scale-[0.98] sm:flex-1 sm:min-w-0"
            >
              <Upload className="h-5 w-5" />
              Upload Photo
            </button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {HERO_BADGES.map((label, i) => {
              const Icon = BADGE_ICONS[i % BADGE_ICONS.length];
              return (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-blue-500" />
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)] sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-auto text-xs font-medium text-slate-400">PassportSnap Preview</span>
            </div>

            <BeforeAfterPreview
              showLabels
              variant="hero"
            />

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CARD_FEATURES.map((feat) => (
                <div
                  key={feat}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-600"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {feat}
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-sky-200/30 blur-3xl" />
        </div>
      </div>
    </section>
  );
}
