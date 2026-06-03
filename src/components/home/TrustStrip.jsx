import { Globe2, ShieldCheck, Star, ThumbsUp } from 'lucide-react';

const STATS = [
  {
    icon: Star,
    value: '4.9/5',
    label: 'from 12,000+ happy users',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    icon: Globe2,
    value: '150+',
    label: 'Countries accepted',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    icon: ShieldCheck,
    value: '100%',
    label: 'Money-back if not accepted',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: ThumbsUp,
    value: '60s',
    label: 'Average time to download',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
];

const AVATARS = [
  '/test-fixtures/external/pexels-headshot-man-1.jpeg',
  '/test-fixtures/external/unsplash-woman-2.jpg',
  '/test-fixtures/external/pexels-man-2.jpeg',
  '/test-fixtures/external/pexels-headshot-woman-4.jpeg',
];

export function TrustStrip() {
  return (
    <section className="px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_40px_-16px_rgba(15,23,42,0.12)]">
          <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            {STATS.map(({ icon: Icon, value, label, color, bg, border }) => (
              <div key={label} className="flex flex-col items-center gap-3 px-6 py-8 sm:items-start">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${bg} ${border}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</div>
                  <div className="mt-0.5 text-sm text-slate-500">{label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {AVATARS.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt="Happy customer"
                    className="h-9 w-9 rounded-full border-2 border-white object-cover object-top shadow-sm"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ))}
              </div>
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">12,000+</span> people have used PassportSnap
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-1.5 text-sm font-semibold text-slate-700">4.9 / 5</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
