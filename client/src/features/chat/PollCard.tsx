import clsx from 'clsx';
import { BarChart3, Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/Toaster';
import type { PollDto } from '@/lib/types';
import { useMessagesStore } from '@/stores/messages';

/** Poll message: vote by clicking options; results update live. */
export function PollCard({ poll, meId }: { poll: PollDto; meId: string }) {
  const { t } = useTranslation();
  const vote = useMessagesStore((s) => s.vote);
  const showToast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);

  const mine = poll.options.filter((o) => o.userIds.includes(meId)).map((o) => o.id);
  const voters = new Set(poll.options.flatMap((o) => o.userIds));
  const total = voters.size;

  const toggle = async (optionId: string) => {
    const selected = mine.includes(optionId);
    const next = poll.multiple ? (selected ? mine.filter((id) => id !== optionId) : [...mine, optionId]) : selected ? [] : [optionId];
    setBusy(true);
    try {
      await vote(poll.id, next);
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-[260px] space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
        <BarChart3 className="size-3.5" aria-hidden="true" />
        {t('poll.title')} · {poll.multiple ? t('poll.multiple') : t('poll.single')}
      </p>
      <p className="font-semibold">{poll.question}</p>
      <div role="group" aria-label={poll.question} className="space-y-1.5">
        {poll.options.map((option) => {
          const selected = mine.includes(option.id);
          const share = total ? Math.round((option.userIds.length / total) * 100) : 0;
          return (
            <button
              key={option.id}
              type="button"
              role={poll.multiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              disabled={busy}
              onClick={() => void toggle(option.id)}
              className={clsx(
                'relative flex w-full items-center gap-2 overflow-hidden rounded-md border px-2.5 py-1.5 text-left text-sm',
                selected ? 'border-accent' : 'border-line hover:border-accent/60',
              )}
            >
              <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-accent/15 transition-[width]" style={{ width: `${share}%` }} />
              <span
                aria-hidden="true"
                className={clsx(
                  'relative flex size-4 shrink-0 items-center justify-center border',
                  poll.multiple ? 'rounded' : 'rounded-full',
                  selected ? 'border-accent bg-accent text-accent-fg' : 'border-subtle',
                )}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="relative flex-1">{option.text}</span>
              <span className="relative text-xs text-muted">
                {option.userIds.length} · {share}%
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">{t('poll.votes', { count: total })}</p>
    </div>
  );
}
