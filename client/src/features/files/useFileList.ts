import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { FileDto } from '@/lib/types';

interface FileListState {
  files: FileDto[];
  loaded: boolean;
  error: boolean;
}

/**
 * Loads a file list (`/files?…`) and reloads it whenever files change in a
 * matching chat or channel (or anywhere, when `scope` is null).
 */
export function useFileList(query: string, scope: { chatId?: string; channelId?: string } | null) {
  const [state, setState] = useState<FileListState & { query: string }>({ files: [], loaded: false, error: false, query });
  const [version, setVersion] = useState(0);
  const chatId = scope?.chatId;
  const channelId = scope?.channelId;
  const global = scope === null;

  useEffect(() => {
    let current = true;
    api
      .get<{ files: FileDto[] }>(`/files?${query}`)
      .then(({ files }) => current && setState({ files, loaded: true, error: false, query }))
      .catch(() => current && setState((s) => ({ ...s, loaded: true, error: true, query })));
    return () => {
      current = false;
    };
  }, [query, version]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onChange = (e: { chatId?: string; channelId?: string }) => {
      if (global || (chatId && e.chatId === chatId) || (channelId && e.channelId === channelId)) setVersion((v) => v + 1);
    };
    socket.on('files:changed', onChange);
    return () => void socket.off('files:changed', onChange);
  }, [chatId, channelId, global]);

  // A new query shows "loading" instead of the previous list.
  const fresh = state.query === query;
  return {
    files: fresh ? state.files : [],
    loaded: fresh && state.loaded,
    error: fresh && state.error,
    reload: () => setVersion((v) => v + 1),
  };
}
