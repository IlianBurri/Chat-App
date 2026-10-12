import { differenceInCalendarDays, format, isSameDay } from 'date-fns';
import { dateLocale } from './format';
import type { MessageDto, ReadReceipt } from './types';

/** Messages by the same person within this gap are grouped under one header. */
const GROUP_GAP_MS = 5 * 60_000;

export type TimelineItem =
  | { kind: 'date'; key: string; date: Date }
  | { kind: 'message'; key: string; message: MessageDto; groupStart: boolean; groupEnd: boolean };

export function buildTimeline(messages: MessageDto[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let previous: MessageDto | undefined;

  messages.forEach((message, index) => {
    const date = new Date(message.createdAt);
    if (!previous || !isSameDay(new Date(previous.createdAt), date)) {
      items.push({ kind: 'date', key: `date-${message.id}`, date });
      previous = undefined;
    }
    const next = messages[index + 1];
    items.push({
      kind: 'message',
      key: message.id,
      message,
      groupStart: !previous || !continues(previous, message),
      groupEnd: !next || !continues(message, next),
    });
    previous = message;
  });

  return items;
}

function continues(a: MessageDto, b: MessageDto): boolean {
  const ta = new Date(a.createdAt);
  const tb = new Date(b.createdAt);
  return (
    a.author.id === b.author.id &&
    a.type !== 'system' &&
    b.type !== 'system' &&
    isSameDay(ta, tb) &&
    tb.getTime() - ta.getTime() <= GROUP_GAP_MS
  );
}

/** "Today", "Yesterday" or a full date for the separators. */
export function dateSeparatorLabel(
  date: Date,
  now: Date,
  language: string | undefined,
  labels: { today: string; yesterday: string },
): string {
  const days = differenceInCalendarDays(now, date);
  if (days === 0) return labels.today;
  if (days === 1) return labels.yesterday;
  const locale = dateLocale(language);
  return format(date, date.getFullYear() === now.getFullYear() ? 'EEEE, d. MMMM' : 'EEEE, d. MMMM yyyy', { locale });
}

/** A message counts as seen when every other member has read up to it. */
export function isSeen(message: MessageDto, receipts: Record<string, ReadReceipt>, memberIds: string[], meId: string): boolean {
  const others = memberIds.filter((id) => id !== meId);
  if (others.length === 0) return false;
  const created = new Date(message.createdAt).getTime();
  return others.every((id) => {
    const receipt = receipts[id];
    return receipt !== undefined && new Date(receipt.readAt).getTime() >= created;
  });
}
