import { differenceInCalendarDays, format, type Locale } from 'date-fns';
import { de, enGB } from 'date-fns/locale';

const LOCALES: Record<string, Locale> = { en: enGB, de };

export function dateLocale(language: string | undefined): Locale {
  return LOCALES[language?.slice(0, 2) ?? 'en'] ?? enGB;
}

/**
 * Compact timestamp for list items: time today, "Yesterday", weekday within
 * the last week, otherwise a short date.
 */
export function formatListTimestamp(
  date: Date,
  now: Date,
  language: string | undefined,
  labels: { yesterday: string },
): string {
  const locale = dateLocale(language);
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return format(date, 'p', { locale });
  if (days === 1) return labels.yesterday;
  if (days < 7) return format(date, 'EEE', { locale });
  if (date.getFullYear() === now.getFullYear()) return format(date, 'd.M.', { locale });
  return format(date, 'd.M.yy', { locale });
}

/** Up to two initials, e.g. "Anna Keller" -> "AK". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

const AVATAR_COLORS = ['#5B5FC7', '#C4314B', '#0F7B6C', '#B35C00', '#8764B8', '#2B7CD3', '#A0459B', '#498205'];

/** Stable avatar colour derived from an id. */
export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Plain-text preview of markdown content for list items. */
export function previewText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/[*_`~>#]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
