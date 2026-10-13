import { splitHighlight } from './splitHighlight';

/** Text with the search query marked. */
export function highlightParts(text: string, query: string) {
  return splitHighlight(text, query).map((part, i) =>
    part.match ? (
      <mark key={i} className="rounded-sm bg-accent-soft font-semibold text-accent">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
