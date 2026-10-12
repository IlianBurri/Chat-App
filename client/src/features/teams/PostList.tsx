import { ChatsCircleIcon, CircleNotchIcon } from '@phosphor-icons/react';
import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/layout/PlaceholderView';
import { Button } from '@/components/ui/Button';
import type { ChannelPosts } from '@/stores/posts';
import { usePostsStore } from '@/stores/posts';
import { PostCard } from './PostCard';

/** Pixels from the bottom within which new activity keeps the view pinned to the end. */
const STICK_THRESHOLD = 160;

interface PostListProps {
  channelId: string;
  state: ChannelPosts;
  meId: string;
  highlightId: string | null;
}

/** Threads oldest-first; scrolls to the newest activity and loads older threads at the top. */
export function PostList({ channelId, state, meId, highlightId }: PostListProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { posts } = state;

  const first = posts[0];
  const last = posts[posts.length - 1];
  const lastKey = last ? `${last.id}:${last.lastActivityAt}:${last.replies.length}` : '';
  const snapshot = useRef({ firstId: first?.id, lastKey, scrollHeight: 0, nearBottom: true, initialised: false });

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    snapshot.current.nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
    if (el.scrollTop < 80 && state.hasMore && !state.loadingOlder) {
      snapshot.current.scrollHeight = el.scrollHeight;
      void usePostsStore.getState().loadOlder(channelId);
    }
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = snapshot.current;
    if (!prev.initialised && posts.length > 0) {
      const target = highlightId ? document.getElementById(`reply-${highlightId}`) ?? document.getElementById(`post-${highlightId}`) : null;
      if (target) target.scrollIntoView({ block: 'center' });
      else el.scrollTop = el.scrollHeight;
      prev.initialised = true;
    } else if (first?.id !== prev.firstId && lastKey === prev.lastKey && prev.scrollHeight) {
      // Older threads were prepended: keep the visible thread in place.
      el.scrollTop += el.scrollHeight - prev.scrollHeight;
      prev.scrollHeight = 0;
    } else if (lastKey !== prev.lastKey) {
      const activityIsMine = last && (last.replies.at(-1)?.author.id ?? last.author.id) === meId;
      if (prev.nearBottom || activityIsMine) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
    prev.firstId = first?.id;
    prev.lastKey = lastKey;
  }, [posts, first?.id, lastKey, last, meId, highlightId]);

  if (!state.loaded) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        <CircleNotchIcon className="size-5 animate-spin" aria-label={t('common.loading')} />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted">
        {t('teams.loadFailed')}
        <Button size="sm" onClick={() => void usePostsStore.getState().load(channelId)}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }
  if (posts.length === 0) {
    return <EmptyState icon={ChatsCircleIcon} title={t('teams.noPostsTitle')} text={t('teams.noPostsText')} />;
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto bg-app">
      <div aria-busy={state.loadingOlder} className="mx-auto max-w-4xl space-y-4 px-5 py-6">
        {state.loadingOlder && (
          <div className="flex justify-center text-muted">
            <CircleNotchIcon className="size-5 animate-spin" aria-label={t('common.loading')} />
          </div>
        )}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} highlightId={highlightId} />
        ))}
      </div>
    </div>
  );
}
