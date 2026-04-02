import { useEffect, useState } from 'react';
import { loadStoredValue, saveStoredValue } from '../lib/utils/storage';

export function useLocalStorage(key, initialValue, legacyKeys = []) {
  const [value, setValue] = useState(() => loadStoredValue(key, initialValue, legacyKeys));

  useEffect(() => {
    saveStoredValue(key, value);
  }, [key, value]);

  return [value, setValue];
}
