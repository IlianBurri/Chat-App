/** One-line plain-text excerpt of markdown content for previews and notifications. */
export function plainExcerpt(content: string, max = 140) {
  const text = content
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(#{1,3}|>|[-*•]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|~~|[*_`])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Excerpt of the text around the first match of `query`, for search results. */
export function excerptAround(content: string, query: string, max = 140) {
  const text = plainExcerpt(content, Number.MAX_SAFE_INTEGER);
  const at = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (at < 0 || text.length <= max) return plainExcerpt(text, max);
  const start = Math.max(0, Math.min(at - 30, text.length - max));
  const slice = text.slice(start, start + max).trim();
  return `${start > 0 ? '…' : ''}${slice}${start + max < text.length ? '…' : ''}`;
}
