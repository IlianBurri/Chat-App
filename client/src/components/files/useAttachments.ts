import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/Toaster';
import { api, ApiError } from '@/lib/api';
import { isImage, MAX_FILE_SIZE, MAX_FILES_PER_ITEM, uploadFile, type UploadTarget } from '@/lib/files';
import type { FileDto } from '@/lib/types';

export interface PendingUpload {
  key: string;
  name: string;
  size: number;
  mimeType: string;
  /** Local preview for images */
  previewUrl: string | null;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  file: FileDto | null;
}

let nextKey = 1;
const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

/**
 * Attachments of a composer: files upload right away (as pending) and are
 * sent along by id. Supports the file picker, drag & drop and pasting.
 */
export function useAttachments(target: UploadTarget) {
  const { t } = useTranslation();
  const showToast = useToast((s) => s.show);
  const [items, setItems] = useState<PendingUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const targetKey = JSON.stringify(target);

  const patch = (key: string, change: Partial<PendingUpload>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)));

  const add = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const room = MAX_FILES_PER_ITEM - itemsRef.current.length;
      if (list.length > room) showToast(t('files.tooMany', { count: MAX_FILES_PER_ITEM }), 'error');
      const parsedTarget = JSON.parse(targetKey) as UploadTarget;

      for (const file of list.slice(0, Math.max(0, room))) {
        if (file.size > MAX_FILE_SIZE) {
          showToast(t('files.tooLarge', { name: file.name }), 'error');
          continue;
        }
        const key = String(nextKey++);
        const controller = new AbortController();
        controllers.current.set(key, controller);
        setItems((current) => [
          ...current,
          {
            key,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            previewUrl: isImage(file.type) ? URL.createObjectURL(file) : null,
            progress: 0,
            status: 'uploading',
            file: null,
          },
        ]);
        uploadFile(file, parsedTarget, { pending: true, signal: controller.signal, onProgress: (progress) => patch(key, { progress }) })
          .then((dto) => patch(key, { status: 'done', progress: 1, file: dto }))
          .catch((err: unknown) => {
            if (err instanceof ApiError && err.code === 'aborted') return;
            patch(key, { status: 'error' });
            showToast(err instanceof ApiError && err.status === 413 ? t('files.tooLarge', { name: file.name }) : t('files.uploadFailed', { name: file.name }), 'error');
          })
          .finally(() => controllers.current.delete(key));
      }
    },
    [targetKey, showToast, t],
  );

  const remove = (key: string) => {
    const item = items.find((i) => i.key === key);
    controllers.current.get(key)?.abort();
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    // The server would clean it up later anyway; this frees the space right away.
    if (item?.file) void api.delete(`/files/${item.file.id}`).catch(() => {});
    setItems((list) => list.filter((i) => i.key !== key));
  };

  /** Takes the finished uploads for sending; `restore` puts them back if sending fails. */
  const take = () => {
    const taken = items;
    setItems([]);
    return {
      fileIds: taken.filter((i) => i.file).map((i) => i.file!.id),
      restore: () => setItems((current) => [...taken, ...current]),
      release: () => taken.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl)),
    };
  };

  // Stop uploads and free previews when the composer goes away.
  useEffect(() => {
    const running = controllers.current;
    return () => {
      running.forEach((c) => c.abort());
      itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    };
  }, []);

  return {
    items,
    add,
    remove,
    take,
    uploading: items.some((i) => i.status === 'uploading'),
    hasFiles: items.some((i) => i.status === 'done'),
    dragging,
    dropProps: {
      onDragOver: (e: DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(true);
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      },
      onDrop: (e: DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(false);
        add(e.dataTransfer.files);
      },
    },
    onPaste: (e: ClipboardEvent) => {
      if (e.clipboardData.files.length === 0) return;
      e.preventDefault();
      add(e.clipboardData.files);
    },
  };
}

export type AttachmentsState = ReturnType<typeof useAttachments>;
