import { Check, X } from 'lucide-react';
import { COMPARISON_ROWS } from '../../data/siteContent';
import { RevealOnScroll } from './RevealOnScroll';

function Cell({ value, highlight }) {
  if (value) {
    return (
      <div className={`flex items-center justify-center ${highlight ? 'text-blue-600' : 'text-emerald-500'}`}>
        <Check className="h-5 w-5" strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center text-slate-300">
      <X className="h-4 w-4" />
    </div>
  );
}

export function ComparisonSection() {
  return (
    <section id="comparison" className="scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <RevealOnScroll className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Why PassportSnap</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            The smarter choice for passport photos
          </h2>
          <p className="mt-4 text-base text-slate-500">
            See why thousands choose PassportSnap over traditional studios and basic online tools.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={80} className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className="px-6 py-5 text-left text-sm font-medium text-slate-500">Feature</th>
                  <th className="bg-blue-600 px-6 py-5 text-center">
                    <div className="text-sm font-bold text-white">PassportSnap</div>
                    <div className="text-[11px] font-medium text-blue-200">Guided online flow</div>
                  </th>
                  <th className="px-6 py-5 text-center">
                    <div className="text-sm font-semibold text-slate-700">Traditional Studio</div>
                    <div className="text-[11px] text-slate-400">In-person</div>
                  </th>
                  <th className="px-6 py-5 text-center">
                    <div className="text-sm font-semibold text-slate-700">Other Online</div>
                    <div className="text-[11px] text-slate-400">DIY tools</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARISON_ROWS.map(({ feature, passportSnap, studio, other }) => (
                  <tr key={feature} className="transition hover:bg-slate-50/70">
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{feature}</td>
                    <td className="bg-blue-50/40 px-6 py-4">
                      <Cell value={passportSnap} highlight />
                    </td>
                    <td className="px-6 py-4">
                      <Cell value={studio} />
                    </td>
                    <td className="px-6 py-4">
                      <Cell value={other} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
