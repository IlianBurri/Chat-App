import cookieParser from 'cookie-parser';
import express from 'express';
import { join, sep } from 'node:path';
import { config } from './config';
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
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

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
  if (config.clientDir) serveClient(app, config.clientDir);
  app.use(errorHandler);
  return app;
}

/** Production: the built web app, with every unknown path answered by index.html (client-side routing). */
function serveClient(app: express.Express, dir: string) {
  app.use(
    express.static(dir, {
      index: false,
      setHeaders: (res, path) => {
        // Vite puts a content hash into every file name under assets/.
        if (path.includes(`${sep}assets${sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  app.get(/^(?!\/(api|socket\.io)(\/|$))/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(dir, 'index.html'));
  });
}
