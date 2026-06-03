import { ArrowLeft, Camera, ShieldCheck, Sparkles } from 'lucide-react';
import { BrandLogo } from '../shared/BrandLogo';

export function AboutView({ onBackHome, onStartFlow }) {
  return (
    <div className="page-shell">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <button
          type="button"
          onClick={onBackHome}
          className="ghost-button -ml-3 mb-5 min-h-10 px-3 py-2 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>

        <section className="surface-card overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <BrandLogo variant="black" alt="PassportSnap" className="h-10 w-auto" />
              <span className="eyebrow mt-8 inline-block">About PassportSnap</span>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Passport photos should be simple, private, and correctly sized.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                PassportSnap was built to remove the friction from getting a passport photo: no studio trip,
                no confusing crop rules, and no guessing whether the finished image matches the required size.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                The full founder story will be added here once provided. For now, the product promise is clear:
                guide each customer from a careful selfie to a correctly formatted passport photo while protecting
                the image and checkout information used to complete the order.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => onStartFlow('camera')} className="primary-button justify-center">
                  <Camera className="h-4 w-4" />
                  Start a photo
                </button>
                <button type="button" onClick={onBackHome} className="secondary-button justify-center">
                  View how it works
                </button>
              </div>
            </div>

            <div className="bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_38%),linear-gradient(145deg,#f8fafc,#e0f2fe)] p-6 sm:p-8 lg:p-10">
              <div className="grid h-full content-center gap-4">
                {[
                  {
                    icon: <Camera className="h-5 w-5" />,
                    title: 'Selfie-first',
                    copy: 'Built for mobile and web so customers can start with the camera they already have.',
                  },
                  {
                    icon: <ShieldCheck className="h-5 w-5" />,
                    title: 'Official-guideline focused',
                    copy: 'U.S. photos are formatted around Department of State size, head geometry, and file rules.',
                  },
                  {
                    icon: <Sparkles className="h-5 w-5" />,
                    title: 'Responsible automation',
                    copy: 'Automation supports crop, size, and quality checks without changing identity or appearance.',
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.38)]">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                        {item.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
                        <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.copy}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
