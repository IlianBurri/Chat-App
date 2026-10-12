import { useEffect } from 'react';
import { useUiStore } from '@/stores/ui';

/** Applies the theme preference to <html>, following the OS setting for "system". */
export function useTheme() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
