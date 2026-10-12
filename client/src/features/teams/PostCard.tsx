import clsx from 'clsx';
import { differenceInCalendarDays, format } from 'date-fns';
import { ArrowBendUpLeftIcon, DotsThreeIcon, LinkSimpleIcon, PencilSimpleIcon, SmileyWinkIcon, TrashIcon } from '@phosphor-icons/react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from '@/components/chat/Markdown';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toaster';
import { QUICK_REACTIONS } from '@/lib/emoji';
import { dateLocale } from '@/lib/format';
import type { PostDto, ReplyDto } from '@/lib/types';
import { usePostsStore } from '@/stores/posts';
import { ReactionChips } from '../chat/ReactionChips';
import { postLink, useChannelContext } from './channelContext';
import { PostEditor } from './PostEditor';

/** Replies shown while a long thread is collapsed. */
export const VISIBLE_REPLIES = 2;

const posts = () => usePostsStore.getState();

function useTimestamp(iso: string) {
  const { i18n } = useTranslation();
  const date = new Date(iso);
  const locale = dateLocale(i18n.resolvedLanguage);
  const short = differenceInCalendarDays(new Date(), date) === 0 ? format(date, 'p', { locale }) : format(date, 'P p', { locale });
  return { short, full: format(date, 'PPPp', { locale }) };
}

interface ToolbarProps {
  label: string;
  canEdit: boolean;
  canDelete: boolean;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onOpenChange: (open: boolean) => void;
}

/** Hover/focus toolbar of a post or reply. */
function ThreadToolbar({ label, canEdit, canDelete, onReact, onReply, onEdit, onDelete, onCopyLink, onOpenChange }: ToolbarProps) {
  const { t } = useTranslation();
  return (
    <div role="toolbar" aria-label={label} className="flex items-center gap-0.5 rounded-lg border border-line bg-main p-0.5 shadow-card">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={t('message.reactWith', { emoji })}
          title={t('message.reactWith', { emoji })}
          onClick={() => onReact(emoji)}
          className="flex size-7 items-center justify-center rounded-md text-base transition-transform hover:scale-125 hover:bg-hover"
        >
          {emoji}
        </button>
      ))}
      <Popover
        label={t('message.moreReactions')}
        placement="top-end"
        onOpenChange={onOpenChange}
        trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('message.moreReactions')} icon={SmileyWinkIcon} size="sm" {...props} />}
      >
        <EmojiPicker onSelect={onReact} />
      </Popover>
      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
      {onReply && <IconButton label={t('message.reply')} icon={ArrowBendUpLeftIcon} size="sm" onClick={onReply} />}
      <Menu
        label={t('message.moreActions')}
        width={210}
        onOpenChange={onOpenChange}
        trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('message.moreActions')} icon={DotsThreeIcon} size="sm" {...props} />}
      >
        {canEdit && (
          <MenuItem icon={PencilSimpleIcon} onSelect={onEdit}>
            {t('message.edit')}
          </MenuItem>
        )}
        <MenuItem icon={LinkSimpleIcon} onSelect={onCopyLink}>
          {t('message.copyLink')}
        </MenuItem>
        {canDelete && (
          <>
            <MenuSeparator />
            <MenuItem icon={TrashIcon} danger onSelect={onDelete}>
              {t('message.delete')}
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
}

interface ItemProps {
  kind: 'post' | 'reply';
  item: PostDto | ReplyDto;
  highlighted: boolean;
  onReply?: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onSave: (content: string, subject: string) => Promise<void>;
  linkReplyId?: string;
}

/** Shared body of posts and replies: header, content, toolbar, reactions, inline editing. */
function ThreadItem({ kind, item, highlighted, onReply, onDelete, onReact, onSave, linkReplyId }: ItemProps) {
  const { t } = useTranslation();
  const { workspace, channel, meId, mentionTargets, candidates } = useChannelContext();
  const showToast = useToast((s) => s.show);
  const [editing, setEditing] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const time = useTimestamp(item.createdAt);
  const own = item.author.id === meId;
  const subject = 'subject' in item ? item.subject : null;
  const postId = 'postId' in item ? item.postId : item.id;
  const authorName = own ? t('common.you') : item.author.name;
  const isPost = kind === 'post';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postLink(workspace.id, channel.id, postId, linkReplyId));
      showToast(t('message.linkCopied'));
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    }
  };

  return (
    <div
      id={`${kind}-${item.id}`}
      role="article"
      tabIndex={0}
      aria-label={t(isPost ? 'teams.postLabel' : 'teams.replyLabel', { name: authorName, time: time.full })}
      className={clsx(
        'group/item relative flex gap-3 rounded-md outline-offset-2',
        isPost ? 'px-4 pt-3 pb-2' : 'py-2 pr-4 pl-14',
        highlighted && 'animate-[highlight_2.5s_ease-out]',
      )}
    >
      <Avatar user={item.author} size={isPost ? 'md' : 'sm'} showStatus className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs">
          <span className="font-semibold text-fg">{item.author.name}</span>
          <time dateTime={item.createdAt} title={time.full} className="text-subtle">
            {time.short}
          </time>
          {item.editedAt && !item.deleted && (
            <span className="inline-flex items-center gap-0.5 text-subtle">
              <PencilSimpleIcon className="size-3" aria-hidden="true" />
              {t('message.edited')}
            </span>
          )}
        </div>

        {item.deleted ? (
          <p className="mt-0.5 text-sm text-muted italic">{t(isPost ? 'teams.deletedPost' : 'teams.deletedReply')}</p>
        ) : editing ? (
          <div className="mt-1">
            <PostEditor
              label={t('message.edit')}
              candidates={candidates}
              initialText={item.content}
              initialSubject={subject ?? ''}
              withSubject={isPost}
              enterSends={!isPost}
              submitLabel={t('common.save')}
              onCancel={() => setEditing(false)}
              onSubmit={async (content, nextSubject) => {
                await onSave(content, nextSubject);
                setEditing(false);
              }}
            />
          </div>
        ) : (
          <>
            {subject && <h3 className="mt-0.5 text-base leading-snug font-semibold">{subject}</h3>}
            <Markdown source={item.content} mentions={mentionTargets} meId={meId} className="mt-0.5 text-sm leading-relaxed" />
          </>
        )}

        <ReactionChips reactions={item.reactions} meId={meId} members={mentionTargets} align="start" onToggle={onReact} />
      </div>

      {!item.deleted && !editing && (
        <div
          className={clsx(
            'absolute -top-4 right-4 z-10',
            toolbarOpen ? 'flex' : 'hidden group-focus-within/item:flex group-hover/item:flex',
          )}
        >
          <ThreadToolbar
            label={t(isPost ? 'teams.postActions' : 'teams.replyActions')}
            canEdit={own}
            canDelete={own || workspace.permissions.moderate}
            onReact={onReact}
            onReply={onReply}
            onEdit={() => setEditing(true)}
            onDelete={onDelete}
            onCopyLink={() => void copyLink()}
            onOpenChange={setToolbarOpen}
          />
        </div>
      )}
    </div>
  );
}

interface PostCardProps {
  post: PostDto;
  /** Post or reply to highlight (from a permalink) */
  highlightId: string | null;
}

/** A channel thread: the post as a card with its replies indented below. */
export const PostCard = memo(function PostCard({ post, highlightId }: PostCardProps) {
  const { t } = useTranslation();
  const { candidates, confirmDelete } = useChannelContext();
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);

  const replies = post.replies;
  const highlightedReply = replies.findIndex((r) => r.id === highlightId);
  const showAll = expanded || replies.length <= VISIBLE_REPLIES + 1 || highlightedReply >= 0;
  const visible = showAll ? replies : replies.slice(-VISIBLE_REPLIES);
  const hiddenCount = replies.length - visible.length;

  return (
    <section
      aria-label={post.subject ?? t('teams.postBy', { name: post.author.name })}
      className="overflow-visible rounded-lg border border-line bg-main shadow-card"
    >
      <ThreadItem
        kind="post"
        item={post}
        highlighted={highlightId === post.id}
        onReply={post.deleted ? undefined : () => setReplying(true)}
        onDelete={() => confirmDelete({ post })}
        onReact={(emoji) => void posts().react(post.id, emoji)}
        onSave={(content, subject) => posts().edit(post.id, { content, subject: subject || null })}
      />

      {replies.length > 0 && (
        <div className="border-t border-line">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-expanded={false}
              className="flex w-full items-center gap-2 py-2 pr-4 pl-14 text-left text-xs font-semibold text-accent hover:underline"
            >
              {t('teams.moreReplies', { count: hiddenCount })}
            </button>
          )}
          {expanded && replies.length > VISIBLE_REPLIES + 1 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded
              className="py-1 pr-4 pl-14 text-left text-xs font-semibold text-muted hover:underline"
            >
              {t('teams.collapseReplies')}
            </button>
          )}
          {visible.map((reply) => (
            <ThreadItem
              key={reply.id}
              kind="reply"
              item={reply}
              highlighted={highlightId === reply.id}
              linkReplyId={reply.id}
              onDelete={() => confirmDelete({ reply })}
              onReact={(emoji) => void posts().reactReply(reply.id, emoji)}
              onSave={(content) => posts().editReply(reply.id, content)}
            />
          ))}
        </div>
      )}

      {!post.deleted && (
        <div className="border-t border-line px-4 py-2">
          {replying ? (
            <div className="pl-10">
              <PostEditor
                label={t('teams.replyPlaceholder')}
                candidates={candidates}
                enterSends
                onCancel={() => setReplying(false)}
                onSubmit={(content) => posts().reply(post.id, content)}
              />
            </div>
          ) : (
            <Button size="sm" variant="ghost" icon={ArrowBendUpLeftIcon} className="text-accent" onClick={() => setReplying(true)}>
              {t('message.reply')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
});
