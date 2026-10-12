import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Global search field; Ctrl/Cmd+K focuses it from anywhere. */
export function SearchBox() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative w-full max-w-[560px]">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={focused && query.length > 0}
        aria-controls="global-search-results"
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setQuery('');
            inputRef.current?.blur();
          }
        }}
        className="h-8 w-full rounded-md border border-transparent bg-input pr-16 pl-8 text-sm text-fg shadow-card outline-none placeholder:text-subtle focus:border-accent focus-visible:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-subtle">
        {isMac ? '⌘ K' : 'Ctrl K'}
      </kbd>
      {focused && query.length > 0 && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label={t('search.label')}
          className="absolute top-full right-0 left-0 z-40 mt-1 rounded-lg border border-line bg-main p-4 text-sm text-muted shadow-pop"
        >
          {t('search.comingSoon')}
        </div>
      )}
    </div>
  );
}
