import { TRUST_BAR_ITEMS } from '../../data/siteContent';

export function TrustBar() {
  return (
    <section className="border-b border-slate-200 bg-white/92">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {TRUST_BAR_ITEMS.map((item, index) => (
          <div
            key={item.label}
            className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.28)] animate-fade-up"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {item.label}
            </div>
            <div className="mt-2 text-base font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-sm text-slate-500">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
