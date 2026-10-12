import { Ellipsis, Forward, Link2, MailWarning, Pencil, Pin, PinOff, Reply, SmilePlus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { QUICK_REACTIONS } from '@/lib/emoji';
import type { MessageDto } from '@/lib/types';

export interface MessageActions {
  react: (message: MessageDto, emoji: string) => void;
  reply: (message: MessageDto) => void;
  edit: (message: MessageDto) => void;
  remove: (message: MessageDto) => void;
  togglePin: (message: MessageDto) => void;
  forward: (message: MessageDto) => void;
  markUnread: (message: MessageDto) => void;
  copyLink: (message: MessageDto) => void;
}

interface MessageToolbarProps {
  message: MessageDto;
  own: boolean;
  actions: MessageActions;
  onOpenChange: (open: boolean) => void;
}

/** Hover/focus toolbar: quick reactions, more reactions, reply and the ⋯ menu. */
export function MessageToolbar({ message, own, actions, onOpenChange }: MessageToolbarProps) {
  const { t } = useTranslation();
  const isText = message.type === 'text';

  return (
    <div role="toolbar" aria-label={t('message.actions')} className="flex items-center gap-0.5 rounded-lg border border-line bg-main p-0.5 shadow-card">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={t('message.reactWith', { emoji })}
          title={t('message.reactWith', { emoji })}
          onClick={() => actions.react(message, emoji)}
          className="flex size-7 items-center justify-center rounded-md text-base transition-transform hover:scale-125 hover:bg-hover"
        >
          {emoji}
        </button>
      ))}
      <Popover
        label={t('message.moreReactions')}
        placement="top-end"
        onOpenChange={onOpenChange}
        trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('message.moreReactions')} icon={SmilePlus} size="sm" {...props} />}
      >
        <EmojiPicker onSelect={(emoji) => actions.react(message, emoji)} />
      </Popover>
      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
      <IconButton label={t('message.reply')} icon={Reply} size="sm" onClick={() => actions.reply(message)} />
      <Menu
        label={t('message.moreActions')}
        width={230}
        onOpenChange={onOpenChange}
        trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('message.moreActions')} icon={Ellipsis} size="sm" {...props} />}
      >
        {own && isText && (
          <MenuItem icon={Pencil} onSelect={() => actions.edit(message)}>
            {t('message.edit')}
          </MenuItem>
        )}
        <MenuItem icon={message.pinned ? PinOff : Pin} onSelect={() => actions.togglePin(message)}>
          {message.pinned ? t('message.unpin') : t('message.pin')}
        </MenuItem>
        {isText && (
          <MenuItem icon={Forward} onSelect={() => actions.forward(message)}>
            {t('message.forward')}
          </MenuItem>
        )}
        <MenuItem icon={MailWarning} onSelect={() => actions.markUnread(message)}>
          {t('message.markUnread')}
        </MenuItem>
        <MenuItem icon={Link2} onSelect={() => actions.copyLink(message)}>
          {t('message.copyLink')}
        </MenuItem>
        {own && (
          <>
            <MenuSeparator />
            <MenuItem icon={Trash2} danger onSelect={() => actions.remove(message)}>
              {t('message.delete')}
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
}
