const WATERMARK_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='280' height='180' viewBox='0 0 280 180'><g transform='rotate(-18 140 90)'><text x='18' y='92' fill='rgba(15,23,42,0.18)' font-family='system-ui,Segoe UI,sans-serif' font-size='26' font-weight='700' letter-spacing='4'>PASSPORTSNAP</text></g></svg>",
)}")`;

export function ProtectedPhotoPreview({
  src,
  alt,
  aspectRatio = '',
  watermarkEnabled = false,
  className = '',
  imageClassName = '',
  children = null,
}) {
  const wrapperStyle = aspectRatio ? { aspectRatio } : undefined;

  return (
    <div className={`relative ${className}`.trim()} style={wrapperStyle}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`h-full w-full select-none object-contain ${imageClassName}`.trim()}
      />

      {watermarkEnabled ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: WATERMARK_TILE,
              backgroundPosition: 'center',
              backgroundRepeat: 'repeat',
              backgroundSize: '220px 150px',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-white/10"
          />
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-end">
            <span className="rounded-full border border-slate-300/85 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-700 shadow-sm backdrop-blur-sm">
              Preview
            </span>
          </div>
        </>
      ) : null}

      {children}
    </div>
  );
}
