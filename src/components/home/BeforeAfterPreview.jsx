import { useEffect, useRef, useState } from 'react';
import { removeBackgroundForPassportExport } from '../../lib/processing/backgroundRemovalClient';

const STATIC_AFTER = '/home-preview/passportsnap-woman-after.jpg';
const STATIC_BEFORE = '/home-preview/passportsnap-woman-before.webp';

function useProcessedImage(src, enabled) {
  const [state, setState] = useState({ status: 'idle', dataUrl: null });
  const attempted = useRef(false);

  useEffect(() => {
    if (!enabled || attempted.current) return;
    attempted.current = true;

    queueMicrotask(() => setState({ status: 'loading', dataUrl: null }));

    removeBackgroundForPassportExport(src)
      .then((result) => {
        setState({ status: 'done', dataUrl: result.dataUrl });
      })
      .catch(() => {
        setState({ status: 'fallback', dataUrl: STATIC_AFTER });
      });
  }, [src, enabled]);

  return state;
}

export function BeforeAfterPreview({
  beforeSrc = STATIC_BEFORE,
  afterSrc = STATIC_AFTER,
  showLabels = true,
  variant = 'hero',
  useLiveProcessing = false,
}) {
  const processed = useProcessedImage(beforeSrc, useLiveProcessing);
  const afterImage = useLiveProcessing
    ? (processed.dataUrl || afterSrc)
    : afterSrc;
  const isLoading = useLiveProcessing && processed.status === 'loading';

  if (variant === 'mini') {
    return (
      <div className="flex gap-2">
        <div className="relative flex-1 overflow-hidden rounded-2xl">
          <img
            src={beforeSrc}
            alt="Before"
            className="h-32 w-full object-cover object-top"
            loading="lazy"
          />
          {showLabels ? (
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Before
            </span>
          ) : null}
        </div>
        <div className="relative flex-1 overflow-hidden rounded-2xl bg-slate-50">
          {isLoading ? (
            <div className="flex h-32 w-full items-center justify-center">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
            </div>
          ) : (
            <img
              src={afterImage}
              alt="After"
              className="h-32 w-full object-cover object-top"
              loading="lazy"
            />
          )}
          {showLabels ? (
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-blue-600/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              After
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === 'phone') {
    return (
      <div className="relative mx-auto w-[180px]">
        <div className="relative overflow-hidden rounded-[28px] border-4 border-slate-800 bg-slate-900 shadow-2xl">
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
            <div className="h-2 w-12 rounded-full bg-slate-700" />
          </div>
          <div className="relative">
            <img
              src={beforeSrc}
              alt="Before selfie"
              className="w-full object-cover"
              style={{ aspectRatio: '3/4' }}
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-32 rounded-full border-2 border-white/60" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="relative overflow-hidden rounded-2xl bg-slate-100">
        <img
          src={beforeSrc}
          alt="Original selfie"
          className="h-full w-full object-cover object-top"
          style={{ minHeight: '240px', maxHeight: '320px' }}
          loading="lazy"
        />
        {showLabels ? (
          <span className="absolute bottom-2 left-2 rounded-lg bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
            Before
          </span>
        ) : null}
      </div>
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-inner">
        {isLoading ? (
          <div className="flex h-full min-h-[240px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              <span className="text-xs text-slate-400">Processing...</span>
            </div>
          </div>
        ) : (
          <img
            src={afterImage}
            alt="Passport photo result"
            className="h-full w-full object-cover object-top"
            style={{ minHeight: '240px', maxHeight: '320px' }}
            loading="lazy"
          />
        )}
        {showLabels ? (
          <span className="absolute bottom-2 left-2 rounded-lg bg-blue-600/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
            After
          </span>
        ) : null}
      </div>
    </div>
  );
}
