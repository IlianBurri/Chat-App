import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http-error';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * State-changing requests must carry a custom header. Browsers only send custom
 * headers cross-origin after a CORS preflight, which this API never allows, so
 * forged form posts from other sites are rejected.
 */
export function requireClientHeader(req: Request, _res: Response, next: NextFunction) {
  if (!SAFE_METHODS.has(req.method) && req.get('X-Client') !== '1') {
    throw new HttpError(403, 'csrf', 'Missing client header');
  }
  next();
}
