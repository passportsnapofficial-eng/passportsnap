export function HeadGuideOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-[11%] h-[70%] w-[58%] -translate-x-1/2 rounded-[999px] border-[3px] border-white/70 shadow-[0_0_0_999px_rgba(15,23,42,0.3)]" />
      <div className="absolute left-1/2 top-[11%] h-[70%] w-px -translate-x-1/2 bg-white/30" />
      <div className="absolute inset-x-[18%] top-[60%] h-px bg-white/30" />
      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-slate-950/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
        Center your face inside the guide
      </div>
    </div>
  );
}
