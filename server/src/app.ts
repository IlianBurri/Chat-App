import cookieParser from 'cookie-parser';
import express from 'express';
import { HttpError } from './lib/http-error';
import { requireAuth } from './middleware/auth';
import { requireClientHeader } from './middleware/csrf';
import { errorHandler } from './middleware/error';
import { authRouter } from './routes/auth';
import { chatsRouter } from './routes/chats';
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
  api.use('/workspaces', requireAuth, workspacesRouter);
  api.use(() => {
    throw new HttpError(404, 'not_found', 'Unknown API route');
  });

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
