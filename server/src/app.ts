import cookieParser from 'cookie-parser';
import express from 'express';
import { HttpError } from './lib/http-error';
import { requireAuth } from './middleware/auth';
import { requireClientHeader } from './middleware/csrf';
import { errorHandler } from './middleware/error';
import { activityRouter } from './routes/activity';
import { authRouter } from './routes/auth';
import { callsRouter } from './routes/calls';
import { channelsRouter } from './routes/channels';
import { chatsRouter } from './routes/chats';
import { filesRouter } from './routes/files';
import { meetingsRouter } from './routes/meetings';
import { messagesRouter } from './routes/messages';
import { pollsRouter } from './routes/polls';
import { postsRouter, repliesRouter } from './routes/posts';
import { searchRouter } from './routes/search';
import { usersRouter } from './routes/users';
import { workspacesRouter } from './routes/workspaces';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(requireClientHeader);
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use('/auth', authRouter);
  api.use('/users', requireAuth, usersRouter);
  api.use('/chats', requireAuth, chatsRouter);
  api.use('/messages', requireAuth, messagesRouter);
  api.use('/polls', requireAuth, pollsRouter);
  api.use('/workspaces', requireAuth, workspacesRouter);
  api.use('/channels', requireAuth, channelsRouter);
  api.use('/posts', requireAuth, postsRouter);
  api.use('/replies', requireAuth, repliesRouter);
  api.use('/activity', requireAuth, activityRouter);
  api.use('/search', requireAuth, searchRouter);
  api.use('/files', requireAuth, filesRouter);
  api.use('/meetings', requireAuth, meetingsRouter);
  api.use('/calls', requireAuth, callsRouter);
  api.use(() => {
    throw new HttpError(404, 'not_found', 'Unknown API route');
  });

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
