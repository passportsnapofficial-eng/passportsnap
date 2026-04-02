const SIZE_MAP = {
  sm: 'h-5 w-7 rounded-md',
  md: 'h-6 w-9 rounded-lg',
  lg: 'h-8 w-11 rounded-xl',
};

export function FlagMark({ src, label, size = 'md', className = '' }) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <span
      className={`inline-flex overflow-hidden border border-slate-200 bg-white shadow-sm ${sizeClass} ${className}`.trim()}
    >
      <img src={src} alt={`${label} flag`} className="h-full w-full object-cover" />
    </span>
  );
}
