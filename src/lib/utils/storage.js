export function loadStoredValue(key, fallbackValue, legacyKeys = []) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallbackValue;
  }

  for (const storageKey of [key, ...legacyKeys]) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) continue;
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }

  return fallbackValue;
}

export function saveStoredValue(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or browser privacy failures in the MVP.
  }
}
