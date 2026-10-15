import clsx from 'clsx';
import { format } from 'date-fns';
import { CheckIcon, EyeIcon, PencilSimpleIcon, PushPinIcon, ShareFatIcon, SignOutIcon, UserPlusIcon } from '@phosphor-icons/react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from '@/components/chat/Markdown';
import { Attachments } from '@/components/files/Attachments';
import { Avatar } from '@/components/ui/Avatar';
import { dateLocale, previewText } from '@/lib/format';
import type { MentionTarget } from '@/lib/markdown';
import type { MessageDto, SystemEvent } from '@/lib/types';
import { MessageEditor } from './MessageEditor';
import { MessageToolbar, type MessageActions } from './MessageToolbar';
import { PollCard } from './PollCard';
import { ReactionChips } from './ReactionChips';

interface MessageItemProps {
  message: MessageDto;
  groupStart: boolean;
  groupEnd: boolean;
  meId: string;
  members: MentionTarget[];
  /** Read state of own messages: true = seen by everyone */
  seen?: boolean;
  editing: boolean;
  highlighted: boolean;
  actions: MessageActions;
  onEditDone: () => void;
  onJumpTo: (messageId: string) => void;
}

export const MessageItem = memo(function MessageItem(props: MessageItemProps) {
  const { message, groupStart, meId } = props;
  if (message.type === 'system') return <SystemMessage message={message} members={props.members} meId={meId} />;

  const own = message.author.id === meId;
  return (
    <div
      id={`message-${message.id}`}
      className={clsx('flex px-5', groupStart ? 'mt-3' : 'mt-0.5', own ? 'justify-end' : 'justify-start')}
    >
      {!own && (
        <div className="mr-2 w-8 shrink-0">
          {groupStart && <Avatar user={message.author} size="md" showStatus />}
        </div>
      )}
      <MessageBody {...props} own={own} />
    </div>
  );
});

function MessageBody({
  message,
  groupStart,
  groupEnd,
  meId,
  members,
  seen,
  editing,
  highlighted,
  actions,
  onEditDone,
  onJumpTo,
  own,
}: MessageItemProps & { own: boolean }) {
  const { t, i18n } = useTranslation();
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const created = new Date(message.createdAt);
  const time = format(created, 'p', { locale: dateLocale(i18n.resolvedLanguage) });
  const fullTime = format(created, 'PPPp', { locale: dateLocale(i18n.resolvedLanguage) });
  const interactive = !message.deleted && !editing;

  return (
    <div className={clsx('group/message relative flex max-w-[min(75%,720px)] min-w-0 flex-col', own ? 'items-end' : 'items-start')}>
      {groupStart && (
        <div className={clsx('mb-0.5 flex items-baseline gap-2 text-xs', own && 'flex-row-reverse')}>
          {!own && <span className="font-semibold text-fg">{message.author.name}</span>}
          <time dateTime={message.createdAt} title={fullTime} className="text-subtle">
            {time}
          </time>
        </div>
      )}

      <div
        role="article"
        tabIndex={0}
        aria-label={t('message.label', { name: own ? t('common.you') : message.author.name, time: fullTime })}
        className={clsx(
          'relative rounded-lg px-3 py-2 text-sm leading-relaxed outline-offset-2 transition-shadow',
          own ? 'bg-accent-soft' : 'bg-bubble',
          message.deleted && 'italic text-muted',
          highlighted && 'animate-[highlight_2.5s_ease-out]',
        )}
      >
        {message.forwardedFrom && (
          <p className="mb-1 flex items-center gap-1 text-xs text-muted not-italic">
            <ShareFatIcon className="size-3.5" aria-hidden="true" />
            {t('message.forwardedFrom', { name: message.forwardedFrom.author.name })}
          </p>
        )}
        {message.replyTo && (
          <button
            type="button"
            onClick={() => onJumpTo(message.replyTo!.id)}
            className="mb-1.5 block w-full rounded-md border-l-[3px] border-accent bg-black/[0.04] px-2 py-1 text-left text-xs dark:bg-white/[0.06]"
          >
            <span className="block font-semibold">{message.replyTo.author.name}</span>
            <span className="line-clamp-2 text-muted">
              {message.replyTo.deleted ? t('chat.deletedMessage') : previewText(message.replyTo.content ?? '')}
            </span>
          </button>
        )}

        {message.deleted ? (
          <p>{t('chat.deletedMessage')}</p>
        ) : editing ? (
          <MessageEditor message={message} onDone={onEditDone} />
        ) : message.poll ? (
          <PollCard poll={message.poll} meId={meId} />
        ) : (
          <>
            {message.subject && <p className="mb-1 text-base font-semibold">{message.subject}</p>}
            {message.content && <Markdown source={message.content} mentions={members} meId={meId} />}
            <Attachments files={message.files} />
          </>
        )}

        {(message.editedAt || message.pinned) && !message.deleted && !editing && (
          <p className="mt-0.5 flex items-center justify-end gap-2 text-[11px] text-subtle">
            {message.pinned && (
              <span className="inline-flex items-center gap-0.5">
                <PushPinIcon className="size-3" aria-hidden="true" />
                {t('message.pinned')}
              </span>
            )}
            {message.editedAt && (
              <span className="inline-flex items-center gap-0.5">
                <PencilSimpleIcon className="size-3" aria-hidden="true" />
                {t('message.edited')}
              </span>
            )}
          </p>
        )}

        {interactive && (
          <div
            className={clsx(
              'absolute -top-5 z-10',
              own ? 'right-0' : 'left-0',
              toolbarOpen ? 'flex' : 'hidden group-focus-within/message:flex group-hover/message:flex',
            )}
          >
            <MessageToolbar message={message} own={own} actions={actions} onOpenChange={setToolbarOpen} />
          </div>
        )}
      </div>

      <ReactionChips
        reactions={message.reactions}
        meId={meId}
        members={members}
        align={own ? 'end' : 'start'}
        onToggle={(emoji) => actions.react(message, emoji)}
      />

      {own && groupEnd && seen !== undefined && !message.deleted && (
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-subtle" aria-label={seen ? t('message.seen') : t('message.sent')} role="img">
          {seen ? <EyeIcon className="size-3.5 text-accent" aria-hidden="true" /> : <CheckIcon className="size-3.5" aria-hidden="true" />}
        </span>
      )}
    </div>
  );
}

function parseSystemEvent(content: string): SystemEvent | null {
  try {
    return JSON.parse(content) as SystemEvent;
  } catch {
    return null;
  }
}

function SystemMessage({ message, members, meId }: { message: MessageDto; members: MentionTarget[]; meId: string }) {
  const { t } = useTranslation();
  const event = parseSystemEvent(message.content);
  if (!event) return null;

  const actor = message.author.id === meId ? t('common.you') : message.author.name;
  const nameOf = (id: string) => (id === meId ? t('common.you') : (members.find((m) => m.id === id)?.name ?? t('chat.someone')));
  const Icon = event.event === 'left' ? SignOutIcon : event.event === 'added' ? UserPlusIcon : PencilSimpleIcon;
  const text =
    event.event === 'added'
      ? t('chat.system.added', { actor, names: event.userIds.map(nameOf).join(', ') })
      : event.event === 'left'
        ? t('chat.system.left', { actor })
        : t('chat.system.renamed', { actor, name: event.name });

  return (
    <div id={`message-${message.id}`} className="my-3 flex items-center justify-center gap-1.5 px-5 text-xs text-muted">
      <Icon className="size-3.5" aria-hidden="true" />
      {text}
    </div>
  );
}
