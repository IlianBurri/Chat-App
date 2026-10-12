import { create } from 'zustand';
import { api } from '@/lib/api';
import type { ChannelDetail, PostDto } from '@/lib/types';

export interface ChannelPosts {
  posts: PostDto[];
  hasMore: boolean;
  loaded: boolean;
  loadingOlder: boolean;
  error: boolean;
}

interface PostsState {
  byChannel: Record<string, ChannelPosts>;
  details: Record<string, ChannelDetail>;
  load: (channelId: string) => Promise<void>;
  loadOlder: (channelId: string) => Promise<void>;
  loadDetail: (channelId: string) => Promise<void>;
  setNotes: (channelId: string, notes: string) => void;
  saveNotes: (channelId: string, notes: string) => Promise<void>;
  upsert: (post: PostDto) => void;
  create: (channelId: string, input: { subject?: string; content: string }) => Promise<PostDto>;
  edit: (postId: string, input: { subject?: string | null; content: string }) => Promise<void>;
  remove: (postId: string) => Promise<void>;
  react: (postId: string, emoji: string) => Promise<void>;
  reply: (postId: string, content: string) => Promise<void>;
  editReply: (replyId: string, content: string) => Promise<void>;
  removeReply: (replyId: string) => Promise<void>;
  reactReply: (replyId: string, emoji: string) => Promise<void>;
  forget: (channelId: string) => void;
  reset: () => void;
}

const empty: ChannelPosts = { posts: [], hasMore: false, loaded: false, loadingOlder: false, error: false };

/** Threads are ordered by last activity, so a new reply moves its thread to the bottom. */
export function upsertByActivity(list: PostDto[], post: PostDto): PostDto[] {
  const next = list.some((p) => p.id === post.id) ? list.map((p) => (p.id === post.id ? post : p)) : [...list, post];
  return next.sort((a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt));
}

export const usePostsStore = create<PostsState>((set, get) => {
  const patch = (channelId: string, fn: (c: ChannelPosts) => Partial<ChannelPosts>) =>
    set((s) => {
      const current = s.byChannel[channelId] ?? empty;
      return { byChannel: { ...s.byChannel, [channelId]: { ...current, ...fn(current) } } };
    });

  const apply = async (request: Promise<{ post: PostDto }>) => {
    const { post } = await request;
    get().upsert(post);
    return post;
  };

  return {
    byChannel: {},
    details: {},

    load: async (channelId) => {
      try {
        const { posts, hasMore } = await api.get<{ posts: PostDto[]; hasMore: boolean }>(`/channels/${channelId}/posts`);
        patch(channelId, () => ({ posts, hasMore, loaded: true, error: false }));
      } catch {
        patch(channelId, () => ({ loaded: true, error: true }));
      }
    },

    loadOlder: async (channelId) => {
      const current = get().byChannel[channelId];
      if (!current?.hasMore || current.loadingOlder || current.posts.length === 0) return;
      patch(channelId, () => ({ loadingOlder: true }));
      try {
        const { posts, hasMore } = await api.get<{ posts: PostDto[]; hasMore: boolean }>(
          `/channels/${channelId}/posts?before=${current.posts[0].id}`,
        );
        patch(channelId, (c) => ({ posts: posts.reduce(upsertByActivity, c.posts), hasMore, loadingOlder: false }));
      } catch {
        patch(channelId, () => ({ loadingOlder: false }));
      }
    },

    loadDetail: async (channelId) => {
      const { channel } = await api.get<{ channel: ChannelDetail }>(`/channels/${channelId}`);
      set((s) => ({ details: { ...s.details, [channelId]: channel } }));
    },

    setNotes: (channelId, notes) =>
      set((s) => (s.details[channelId] ? { details: { ...s.details, [channelId]: { ...s.details[channelId], notes } } } : s)),

    saveNotes: async (channelId, notes) => {
      await api.patch(`/channels/${channelId}/notes`, { notes });
      get().setNotes(channelId, notes);
    },

    // Only channels that are loaded are tracked; others load fresh when opened.
    upsert: (post) => {
      if (!get().byChannel[post.channelId]?.loaded) return;
      patch(post.channelId, (c) => ({ posts: upsertByActivity(c.posts, post) }));
    },

    create: (channelId, input) => apply(api.post(`/channels/${channelId}/posts`, input)),
    edit: async (postId, input) => void (await apply(api.patch(`/posts/${postId}`, input))),
    remove: async (postId) => void (await apply(api.delete(`/posts/${postId}`))),
    react: async (postId, emoji) => void (await apply(api.post(`/posts/${postId}/reactions`, { emoji }))),
    reply: async (postId, content) => void (await apply(api.post(`/posts/${postId}/replies`, { content }))),
    editReply: async (replyId, content) => void (await apply(api.patch(`/replies/${replyId}`, { content }))),
    removeReply: async (replyId) => void (await apply(api.delete(`/replies/${replyId}`))),
    reactReply: async (replyId, emoji) => void (await apply(api.post(`/replies/${replyId}/reactions`, { emoji }))),

    forget: (channelId) =>
      set((s) => {
        const byChannel = { ...s.byChannel };
        const details = { ...s.details };
        delete byChannel[channelId];
        delete details[channelId];
        return { byChannel, details };
      }),

    reset: () => set({ byChannel: {}, details: {} }),
  };
});
