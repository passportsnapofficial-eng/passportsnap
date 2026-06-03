export function waitForNextPaint() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      globalThis.setTimeout(resolve, 0);
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}
