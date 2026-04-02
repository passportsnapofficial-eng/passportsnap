import { FlagMark } from '../shared/FlagMark';

export function ResultPreviewCard({ result }) {
  const metadataRows = [
    { label: 'Document', value: result.documentName },
    { label: 'Output', value: result.sizeLabel },
    { label: 'Resolution', value: result.outputLabel },
    { label: 'Background', value: result.backgroundLabel },
  ];

  return (
    <div className="surface-card overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {result.flagPath ? <FlagMark src={result.flagPath} label={result.countryLabel} size="lg" /> : null}
          <div>
            <div className="text-sm font-semibold text-slate-900">{result.countryLabel}</div>
            <div className="text-sm text-slate-500">{result.authority}</div>
          </div>
        </div>
        <div
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            result.status === 'passed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {result.status === 'passed' ? 'Initial check passed' : 'Retake recommended'}
        </div>
      </div>

      <div className="mt-5 rounded-[34px] bg-slate-100 p-4">
        <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-inner">
          <div
            className="relative bg-white p-4"
            style={{
              aspectRatio: `${result.outputWidth || result.metadata?.outputWidth || 1} / ${
                result.outputHeight || result.metadata?.outputHeight || 1
              }`,
            }}
          >
            <img
              src={result.processedPhoto}
              alt="Processed passport photo preview"
              className="h-full w-full rounded-[20px] object-contain"
            />
            <div className="pointer-events-none absolute inset-[10%] rounded-[24px] border border-slate-300/80" />
            <div className="pointer-events-none absolute inset-x-[28%] top-[18%] h-[52%] rounded-[999px] border border-blue-300/60" />
            <div className="pointer-events-none absolute left-1/2 top-[10%] h-[72%] w-px -translate-x-1/2 bg-slate-300/70" />
            <div className="pointer-events-none absolute inset-x-[18%] bottom-[18%] h-px bg-slate-300/70" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {metadataRows.map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {item.label}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
