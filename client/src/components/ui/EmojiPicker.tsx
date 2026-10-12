import clsx from 'clsx';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EMOJI_CATEGORIES, recentEmojis, rememberEmoji } from '@/lib/emoji';
import { usePopover } from './Popover';

/** Emoji grid with categories and recently used emojis. Closes the surrounding popover on pick. */
export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { t } = useTranslation();
  const popover = usePopover();
  const [recent] = useState(recentEmojis);
  const [category, setCategory] = useState<string>(recent.length ? 'recent' : EMOJI_CATEGORIES[0].id);

  const tabs = [
    ...(recent.length ? [{ id: 'recent', icon: '🕘', emojis: recent }] : []),
    ...EMOJI_CATEGORIES,
  ];
  const active = tabs.find((c) => c.id === category) ?? tabs[0];

  const pick = (emoji: string) => {
    rememberEmoji(emoji);
    popover?.close();
    onSelect(emoji);
  };

  return (
    <div className="w-[320px]">
      <div role="tablist" aria-label={t('emoji.categories')} className="flex gap-0.5 border-b border-line p-1.5">
        {tabs.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === active.id}
            aria-label={t(`emoji.category.${c.id}`)}
            title={t(`emoji.category.${c.id}`)}
            onClick={() => setCategory(c.id)}
            className={clsx('flex size-8 items-center justify-center rounded-md text-lg', c.id === active.id ? 'bg-accent-soft' : 'hover:bg-hover')}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={t(`emoji.category.${active.id}`)} className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-1.5">
        {active.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            onClick={() => pick(emoji)}
            className="flex size-9 items-center justify-center rounded-md text-xl hover:bg-hover"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
