import { CheckCircle2, ScanFace } from 'lucide-react';
import { PROCESS_PREVIEW_ITEMS } from '../../data/siteContent';

export function ProcessPreviewSection() {
  return (
    <section id="process-preview" className="scroll-mt-28 py-18 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:px-8">
        <div className="animate-fade-up">
          <span className="eyebrow">Process preview</span>
          <h2 className="section-title mt-4">
            A product screen that looks like technical guidance, not a generic loading state.
          </h2>
          <p className="section-copy mt-4">
            The processing step calls out what the system is checking so the user sees progress,
            understands the automation, and trusts the result before checkout.
          </p>

          <div className="mt-8 space-y-4">
            {PROCESS_PREVIEW_ITEMS.map((item) => (
              <div key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]">
                <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-scale-in">
          <div className="absolute -right-8 top-10 hidden h-40 w-40 rounded-full bg-blue-100 blur-3xl lg:block" />
          <div className="surface-card overflow-hidden bg-slate-950 p-5 text-white">
            <div className="grid gap-4 sm:grid-cols-[1.02fr_0.98fr]">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white">Processing preview</div>
                <div className="mt-4 relative overflow-hidden rounded-[24px] border border-white/10 bg-slate-900">
                  <div className="aspect-square bg-[linear-gradient(180deg,#111827_0%,#1e293b_100%)] p-4">
                    <div className="relative h-full rounded-[20px] bg-white">
                      <img
                        src="https://images.unsplash.com/photo-1546961329-78bef0414d7c?auto=format&fit=crop&w=900&q=80"
                        alt="Processing mock"
                        className="h-full w-full rounded-[20px] object-cover"
                      />
                      <div className="pointer-events-none absolute inset-[11%] rounded-[24px] border border-slate-300/80" />
                      <div className="pointer-events-none absolute inset-x-[30%] top-[18%] h-[52%] rounded-[999px] border border-cyan-300/70" />
                      <div className="pointer-events-none absolute left-1/2 top-[12%] h-[70%] w-px -translate-x-1/2 bg-slate-300/70" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    Background ready
                  </div>
                  <div className="mt-3 text-sm text-slate-300">
                    White-background export surface created.
                  </div>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                    <ScanFace className="h-4 w-4" />
                    Detecting face
                  </div>
                  <div className="mt-3 text-sm text-slate-300">
                    Framing and proportion checks stay visible during the run.
                  </div>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Timeline</div>
                  <div className="mt-3 space-y-3">
                    {['Face position', 'Official dimensions', 'White background', 'Export ready'].map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm text-slate-200">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                        {item}
                      </div>
                    ))}
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
