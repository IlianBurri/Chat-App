import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db';
import { emitMessage, requireChatMember } from '../lib/chats';
import {
  accessibleFilesWhere,
  deleteFiles,
  emitFilesChanged,
  fileInclude,
  MAX_FILE_SIZE,
  requireFileAccess,
  storedNameFor,
  toFileDto,
  uploadDir,
} from '../lib/files';
import { forbidden, HttpError } from '../lib/http-error';
import { emitPost } from '../lib/posts';
import { requireChannelAccess } from '../lib/workspaces';
import { currentUserId } from '../middleware/auth';

export const filesRouter = Router();

const id = z.string().min(1).max(40);
const target = z.union([z.object({ chatId: id }), z.object({ channelId: id })]);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, storedNameFor(file.originalname)),
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  // File names are UTF-8 in every current browser.
  defParamCharset: 'utf8',
});

/** Turns multer's errors (too large, wrong field) into API errors. */
function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(err.code === 'LIMIT_FILE_SIZE' ? new HttpError(413, 'file_too_large', 'File too large') : new HttpError(400, 'validation', err.message));
    } else next(err);
  });
}

const safeMimeType = (value: string) => (/^[\w.+-]+\/[\w.+-]+$/.test(value) ? value.toLowerCase() : 'application/octet-stream');

/**
 * Uploads one file to a chat or channel. `?pending=1` (composer attachments)
 * keeps it hidden until it is sent with a message, post or reply.
 */
filesRouter.post(
  '/',
  async (req, _res, next) => {
    // Check access before anything is written to disk.
    const scope = target.parse(req.query);
    const userId = currentUserId(req);
    if ('chatId' in scope) await requireChatMember(scope.chatId, userId);
    else await requireChannelAccess(scope.channelId, userId);
    next();
  },
  handleUpload,
  async (req, res) => {
    const userId = currentUserId(req);
    const scope = target.parse(req.query);
    const pending = req.query.pending === '1';
    if (!req.file) throw new HttpError(400, 'validation', 'No file');
    const file = await prisma.file.create({
      data: {
        uploaderId: userId,
        originalName: req.file.originalname.slice(0, 255) || 'file',
        storedName: req.file.filename,
        mimeType: safeMimeType(req.file.mimetype),
        size: req.file.size,
        pending,
        ...scope,
      },
      include: fileInclude,
    });
    if (!pending) emitFilesChanged(scope);
    res.status(201).json({ file: toFileDto(file) });
  },
);

const listQuery = z.object({
  chatId: id.optional(),
  channelId: id.optional(),
  /** Files app views */
  view: z.enum(['all', 'mine', 'chats', 'channels']).default('all'),
  q: z.string().trim().max(100).optional(),
});

/** Files of one chat or channel, or (Files app) of everything the user can see. */
filesRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const { chatId, channelId, view, q } = listQuery.parse(req.query);
  let where: Prisma.FileWhereInput;
  if (chatId) {
    await requireChatMember(chatId, userId);
    where = { chatId, pending: false };
  } else if (channelId) {
    await requireChannelAccess(channelId, userId);
    where = { channelId, pending: false };
  } else {
    where = {
      ...(await accessibleFilesWhere(userId)),
      ...(view === 'mine' ? { uploaderId: userId } : view === 'chats' ? { chatId: { not: null } } : view === 'channels' ? { channelId: { not: null } } : {}),
    };
  }
  const files = await prisma.file.findMany({
    where: { ...where, ...(q ? { originalName: { contains: q } } : {}) },
    include: fileInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ files: files.map(toFileDto) });
});

/**
 * The file content. Always sent as a download in a sandbox, so uploaded HTML
 * or SVG can never run inside the app; <img> previews still work.
 */
filesRouter.get('/:fileId/content', async (req, res) => {
  const file = await requireFileAccess(req.params.fileId, currentUserId(req));
  res.attachment(file.originalName);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=86400');
  // With `root`, the dotfile check only covers the stored name, not the upload folder's path
  // (the desktop app keeps uploads in ~/.config/… on Linux).
  res.sendFile(file.storedName, { root: uploadDir }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ code: 'not_found', message: 'File content missing' });
  });
});

/** The uploader removes a file; owners of the workgroup may remove channel files. */
filesRouter.delete('/:fileId', async (req, res) => {
  const userId = currentUserId(req);
  const file = await requireFileAccess(req.params.fileId, userId);
  if (file.uploaderId !== userId) {
    const canModerate = file.channelId ? (await requireChannelAccess(file.channelId, userId)).can.moderate : false;
    if (!canModerate) throw forbidden();
  }
  await deleteFiles({ id: file.id });
  if (file.messageId) await emitMessage('message:updated', file.messageId);
  if (file.postId) await emitPost(file.postId, 'edit', userId);
  emitFilesChanged(file);
  res.status(204).end();
});
