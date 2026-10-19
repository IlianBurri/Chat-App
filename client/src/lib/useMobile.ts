import { useSyncExternalStore } from 'react';

/** Below Tailwind's `md` breakpoint (768px) the app shows one column and a bottom tab bar. */
const QUERY = '(max-width: 767.98px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
}
