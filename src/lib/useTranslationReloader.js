import { useState, useCallback } from 'react';
import i18n from './i18n';

// Hook to reload translations and force a re-render
export default function useTranslationReloader() {
  const [, setTick] = useState(0);

  const reloadTranslations = useCallback(() => {
    i18n.reloadResources().then(() => {
      setTick(tick => tick + 1); // force update
    });
  }, []);

  return reloadTranslations;
}
