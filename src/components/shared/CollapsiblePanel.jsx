import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function CollapsiblePanel({
  title,
  subtitle = '',
  defaultOpen = false,
  className = '',
  contentClassName = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`overflow-hidden rounded-[24px] border border-slate-200 bg-white/96 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.22)] transition duration-300 hover:border-slate-300 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition duration-300 hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
        </div>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition duration-300 ${open ? 'bg-blue-100 text-blue-700' : 'bg-slate-100'}`}>
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open ? (
        <div className={`border-t border-slate-200 px-4 pb-4 pt-3 ${contentClassName}`.trim()}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
