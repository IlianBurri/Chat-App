import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SearchResults } from '@/lib/types';

const DEBOUNCE_MS = 200;

interface Answer {
  query: string;
  results: SearchResults | null;
}

/**
 * Searches while the user types (debounced). Until the answer for the current
 * query arrives, the previous results stay visible with `loading` set.
 */
export function useGlobalSearch(query: string) {
  const q = query.trim();
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!q) return;
    let current = true;
    const timer = window.setTimeout(() => {
      api
        .get<SearchResults>(`/search?q=${encodeURIComponent(q)}`)
        .then((results) => current && setAnswer({ query: q, results }))
        .catch(() => current && setAnswer({ query: q, results: null }));
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [q]);

  const fresh = answer?.query === q;
  return {
    results: q ? (answer?.results ?? null) : null,
    loading: q !== '' && !fresh,
    error: fresh && answer.results === null,
  };
}
