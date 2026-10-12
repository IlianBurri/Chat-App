import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { PublicUser, ReactionSummary } from '@/lib/types';

interface ReactionChipsProps {
  reactions: ReactionSummary[];
  meId: string;
  members: Pick<PublicUser, 'id' | 'name'>[];
  onToggle: (emoji: string) => void;
  align: 'start' | 'end';
}

/** Small counter chips below a message; your own reactions are highlighted. */
export function ReactionChips({ reactions, meId, members, onToggle, align }: ReactionChipsProps) {
  const { t } = useTranslation();
  if (reactions.length === 0) return null;

  const nameOf = (id: string) => (id === meId ? t('common.you') : (members.find((m) => m.id === id)?.name ?? '?'));

  return (
    <div className={clsx('mt-1 flex flex-wrap gap-1', align === 'end' && 'justify-end')}>
      {reactions.map((r) => {
        const mine = r.userIds.includes(meId);
        const names = r.userIds.map(nameOf).join(', ');
        return (
          <button
            key={r.emoji}
            type="button"
            aria-pressed={mine}
            aria-label={t('message.reactionChip', { emoji: r.emoji, count: r.userIds.length, names })}
            title={names}
            onClick={() => onToggle(r.emoji)}
            className={clsx(
              'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium',
              mine ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-main text-fg hover:bg-hover',
            )}
          >
            <span className="text-sm leading-none">{r.emoji}</span>
            {r.userIds.length}
          </button>
        );
      })}
    </div>
  );
}
