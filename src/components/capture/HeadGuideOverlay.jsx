export function HeadGuideOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-[14%] h-[68%] w-[54%] -translate-x-1/2 rounded-[999px] border-[3px] border-white/55 shadow-[0_0_0_999px_rgba(15,23,42,0.16)]" />
      <div className="absolute inset-x-0 top-[52%] h-px bg-white/30" />
      <div className="absolute left-1/2 top-[14%] h-[68%] w-px -translate-x-1/2 bg-white/18" />
      <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-slate-950/65 px-4 py-2 text-xs font-medium text-white backdrop-blur">
        Keep your head centered and shoulders visible
      </div>
    </div>
  );
}
