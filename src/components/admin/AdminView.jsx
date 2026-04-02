import { Settings } from 'lucide-react';
import { ADMIN_DEMO_ITEM, ADMIN_DEMO_STATS } from '../../data/adminDemo';

export function AdminView() {
  return (
    <div className="page-shell py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-950 px-6 py-8 text-white sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.22em] text-blue-200">
                    Demo admin preview
                  </div>
                  <h1 className="mt-1 text-3xl font-semibold">Manual review queue mock</h1>
                </div>
              </div>
              <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-slate-200">
                Non-production preview
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-8 sm:px-8 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {ADMIN_DEMO_STATS.map((item) => (
                <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {ADMIN_DEMO_ITEM.orderId} - {ADMIN_DEMO_ITEM.documentName}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{ADMIN_DEMO_ITEM.submittedLabel}</div>
                </div>
                <div className="inline-flex gap-2">
                  <button type="button" className="secondary-button">
                    Reject
                  </button>
                  <button type="button" className="primary-button">
                    Approve
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {ADMIN_DEMO_ITEM.checklist.map((item) => (
                  <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {item.label}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
