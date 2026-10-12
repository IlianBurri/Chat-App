import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { verifySession } from '../lib/auth';
import { HttpError } from '../lib/http-error';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const userId = verifySession(req.cookies?.[config.cookieName]);
  if (!userId) throw new HttpError(401, 'unauthenticated', 'Please sign in');
  req.userId = userId;
  next();
}

/** The authenticated user's id; only valid behind requireAuth. */
export function currentUserId(req: Request): string {
  if (!req.userId) throw new HttpError(401, 'unauthenticated', 'Please sign in');
  return req.userId;
}
