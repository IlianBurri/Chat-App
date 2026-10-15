import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { config } from '../config';
import { prisma } from '../db';
import { getIo, rooms } from '../socket/realtime';
import { HttpError, notFound } from './http-error';
import { visibleChannelIds } from './workspaces';

export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_FILES_PER_ITEM = 10;
/** Ids of pending uploads sent along with a message, post or reply. */
export const fileIdsSchema = z.array(z.string().min(1).max(40)).max(MAX_FILES_PER_ITEM).optional();

/** Text may be empty when files are attached. */
export const hasContentOrFiles = (input: { content: string; fileIds?: string[] }) => input.content.length > 0 || (input.fileIds?.length ?? 0) > 0;

/** Composer uploads that were never sent are removed after this long. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export const uploadDir = resolve(config.uploadDir);
mkdirSync(uploadDir, { recursive: true });

/** Random name on disk; only a short, safe extension is kept from the original. */
export function storedNameFor(originalName: string) {
  const ext = extname(originalName).toLowerCase();
  return randomUUID() + (/^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '');
}

export function storedPath(storedName: string) {
  return resolve(uploadDir, storedName);
}

export const fileInclude = {
  uploader: { select: { id: true, name: true } },
  channel: { select: { workspaceId: true } },
} satisfies Prisma.FileInclude;

type FileRow = Prisma.FileGetPayload<{ include: typeof fileInclude }>;

/** Sent attachments of a message, post or reply, in upload order. */
export const attachmentInclude = {
  where: { pending: false },
  include: fileInclude,
  orderBy: { createdAt: 'asc' },
} as const;

export function toFileDto(f: FileRow) {
  return {
    id: f.id,
    name: f.originalName,
    mimeType: f.mimeType,
    size: f.size,
    createdAt: f.createdAt,
    uploader: f.uploader,
    chatId: f.chatId,
    channelId: f.channelId,
    workspaceId: f.channel?.workspaceId ?? null,
    messageId: f.messageId,
    postId: f.postId,
    replyId: f.replyId,
  };
}

export type FileDto = ReturnType<typeof toFileDto>;

/** Files the user may see: in their chats or in channels visible to them. */
export async function accessibleFilesWhere(userId: string): Promise<Prisma.FileWhereInput> {
  return {
    pending: false,
    OR: [{ chat: { members: { some: { userId } } } }, { channelId: { in: await visibleChannelIds(userId) } }],
  };
}

/** Loads a file the user may open; pending uploads only for their uploader. */
export async function requireFileAccess(fileId: string, userId: string) {
  const file = await prisma.file.findUnique({ where: { id: fileId }, include: fileInclude });
  if (!file || (file.pending && file.uploaderId !== userId)) throw notFound('File');
  const allowed = file.chatId
    ? (await prisma.chatMember.count({ where: { chatId: file.chatId, userId } })) > 0
    : file.channelId !== null && (await visibleChannelIds(userId)).includes(file.channelId);
  if (!allowed) throw notFound('File');
  return file;
}

/**
 * Attaches the user's own pending uploads to new content. They must have been
 * uploaded for the same chat or channel.
 */
export async function attachFiles(
  fileIds: string[] | undefined,
  userId: string,
  target: { chatId: string; messageId: string } | { channelId: string; postId: string; replyId?: string },
) {
  if (!fileIds?.length) return;
  const scope = 'chatId' in target ? { chatId: target.chatId } : { channelId: target.channelId };
  const { count } = await prisma.file.updateMany({
    where: { id: { in: fileIds }, uploaderId: userId, pending: true, ...scope },
    data: {
      pending: false,
      ...('messageId' in target ? { messageId: target.messageId } : { postId: target.postId, replyId: target.replyId ?? null }),
    },
  });
  if (count !== new Set(fileIds).size) throw new HttpError(400, 'validation', 'Unknown attachment');
}

/** Checks attachments before anything is created, so a bad id doesn't leave half-written content. */
export async function assertPendingFiles(fileIds: string[] | undefined, userId: string, scope: { chatId: string } | { channelId: string }) {
  if (!fileIds?.length) return;
  const count = await prisma.file.count({ where: { id: { in: fileIds }, uploaderId: userId, pending: true, ...scope } });
  if (count !== new Set(fileIds).size) throw new HttpError(400, 'validation', 'Unknown attachment');
}

/** Tells everyone in the chat or channel to refresh its files tab. */
export function emitFilesChanged(scope: { chatId?: string | null; channelId?: string | null }) {
  const io = getIo();
  if (scope.chatId) io.to(rooms.chat(scope.chatId)).emit('files:changed', { chatId: scope.chatId });
  if (scope.channelId) io.to(rooms.channel(scope.channelId)).emit('files:changed', { channelId: scope.channelId });
}

/** Deletes file rows and their content on disk (e.g. when a message is deleted). */
export async function deleteFiles(where: Prisma.FileWhereInput) {
  const files = await prisma.file.findMany({ where, select: { id: true, storedName: true } });
  if (files.length === 0) return;
  await prisma.file.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
  await Promise.all(files.map((f) => unlink(storedPath(f.storedName)).catch(() => {})));
}

export function removeStalePendingFiles() {
  return deleteFiles({ pending: true, createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) } });
}
