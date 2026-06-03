import { Camera, Download, FileBadge2, Lightbulb, Ruler, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { HOW_IT_WORKS_STEPS } from '../../data/siteContent';
import { RevealOnScroll } from './RevealOnScroll';

const STEP_ICONS = [FileBadge2, Camera, Sparkles, Download];
const STEP_COLORS = [
  { icon: 'bg-blue-600', ring: 'border-blue-100', number: 'text-blue-600' },
  { icon: 'bg-violet-600', ring: 'border-violet-100', number: 'text-violet-600' },
  { icon: 'bg-emerald-600', ring: 'border-emerald-100', number: 'text-emerald-600' },
  { icon: 'bg-amber-500', ring: 'border-amber-100', number: 'text-amber-600' },
];

const PHOTO_GUIDES = [
  {
    title: 'Before and after',
    copy: 'Start with a clear selfie, then review the formatted 2 x 2 inch result before checkout.',
    type: 'beforeAfter',
  },
  {
    title: 'Front-facing distance',
    copy: 'Stand several feet from the camera and wall so your shoulders and full head fit cleanly.',
    type: 'distance',
  },
  {
    title: 'Keep head straight',
    copy: 'Face the camera directly. Do not tilt your head up, down, or sideways.',
    type: 'straight',
  },
  {
    title: 'Use the right light',
    copy: 'Use soft, even light on the face with no harsh shadows on the face or background.',
    type: 'light',
  },
];

const STATE_GUIDELINES = [
  'Printed applications: Exactly 2 x 2 inches (51 x 51 mm).',
  'Head Geometry: Your head must measure between 1 inch and 1.375 inches (25 to 35 mm) from the bottom of your chin to the top of your head.',
  'Online renewal: JPEG/JPG, PNG, HEIC, or HEIF file between 54 KB and 10 MB, with minimum dimensions of 600 x 600 pixels.',
  'Do not use filters, retouching tools, or AI to change your appearance.',
];

function GuideVisual({ type }) {
  if (type === 'beforeAfter') {
    return (
      <div className="grid h-full grid-cols-2 gap-2">
        <div className="relative overflow-hidden rounded-[22px] bg-slate-100">
          <img src="/home-preview/passportsnap-woman-before.webp" alt="Before passport selfie" className="h-full w-full object-cover object-top" loading="lazy" />
          <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
            Before
          </span>
        </div>
        <div className="relative overflow-hidden rounded-[22px] bg-white">
          <img src="/home-preview/passportsnap-woman-after.jpg" alt="After formatted passport photo" className="h-full w-full object-cover object-top" loading="lazy" />
          <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
            After
          </span>
        </div>
      </div>
    );
  }

  if (type === 'distance') {
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#eff6ff,#ffffff)]">
        <div className="absolute left-6 top-5 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
          <Ruler className="h-4 w-4" />
          Several feet
        </div>
        <div className="absolute bottom-8 left-8 right-8 h-0.5 bg-blue-200" />
        <div className="absolute bottom-6 left-8 h-5 w-0.5 bg-blue-400" />
        <div className="absolute bottom-6 right-8 h-5 w-0.5 bg-blue-400" />
        <div className="h-20 w-14 rounded-[40%] bg-slate-300" />
        <div className="ml-16 h-36 w-24 rounded-[32px] border-4 border-blue-400 bg-white shadow-[0_20px_50px_-34px_rgba(37,99,235,0.6)]">
          <div className="mx-auto mt-5 h-14 w-11 rounded-full bg-amber-100" />
          <div className="mx-auto mt-2 h-8 w-16 rounded-t-full bg-slate-700" />
        </div>
      </div>
    );
  }

  if (type === 'straight') {
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[22px] bg-slate-50">
        <div className="absolute inset-y-8 left-1/2 w-px bg-blue-300" />
        <div className="absolute left-1/2 top-10 h-5 w-5 -translate-x-1/2 rounded-full border border-blue-300" />
        <div className="relative h-32 w-24 rounded-[38px] bg-amber-100 shadow-[0_24px_54px_-42px_rgba(15,23,42,0.7)]">
          <div className="absolute left-5 top-11 h-2 w-2 rounded-full bg-slate-800" />
          <div className="absolute right-5 top-11 h-2 w-2 rounded-full bg-slate-800" />
          <div className="absolute left-1/2 top-20 h-0.5 w-8 -translate-x-1/2 rounded-full bg-slate-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_top,#fef3c7,transparent_48%),#fff7ed]">
      <Sun className="absolute left-8 top-7 h-12 w-12 text-amber-400" />
      <div className="absolute right-7 top-9 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm">
        Even light
      </div>
      <div className="h-32 w-24 rounded-[38px] bg-amber-100 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.7)]" />
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <RevealOnScroll className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Simple process. Clean results.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
            From selfie to finished passport photo in four quick steps on both mobile and web apps.
          </p>
        </RevealOnScroll>

        <div className="relative mt-12">
          <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[2.25rem] hidden h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent lg:block" />

          <div className="grid gap-5 sm:gap-6 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((step, index) => {
              const Icon = STEP_ICONS[index];
              const color = STEP_COLORS[index];
              return (
                <RevealOnScroll
                  key={step.title}
                  delay={index * 80}
                >
                  <div className="relative flex flex-col items-center text-center lg:items-center">
                    <div className="relative flex flex-col items-center">
                      <div className={`absolute -inset-3 rounded-full border-4 ${color.ring} opacity-0 transition-opacity group-hover:opacity-100`} />
                      <div className={`relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl ${color.icon} text-white shadow-lg`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className={`mt-3 text-xs font-bold uppercase tracking-[0.2em] ${color.number}`}>
                        Step {index + 1}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-5 py-5 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.1)]">
                      <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{step.description}</p>
                    </div>
                  </div>
                </RevealOnScroll>
              );
            })}
          </div>
        </div>

        <RevealOnScroll delay={120} className="mt-14">
          <div className="rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#ffffff)] p-4 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.42)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="eyebrow">Photo setup</span>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  Take the right photo before processing
                </h3>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                <Lightbulb className="h-4 w-4" />
                Better input, better result
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {PHOTO_GUIDES.map((guide) => (
                <div key={guide.title} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white p-3">
                  <div className="h-48">
                    <GuideVisual type={guide.type} />
                  </div>
                  <div className="px-1 pb-1 pt-4">
                    <h4 className="text-base font-semibold text-slate-950">{guide.title}</h4>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600">{guide.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={160} className="mt-6">
          <div className="rounded-[28px] border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-950">U.S. Department of State photo guidelines</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  PassportSnap should continue to follow these official rules, including when automation is added later.
                </p>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {STATE_GUIDELINES.map((guideline) => (
                    <div key={guideline} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                      {guideline}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
