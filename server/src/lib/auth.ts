import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface SessionPayload {
  sub: string;
}

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId } satisfies SessionPayload, config.jwtSecret, {
    expiresIn: `${config.sessionDays}d`,
  });
}

/** Returns the user id of a valid session token, otherwise null. */
export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, userId: string) {
  res.cookie(config.cookieName, signSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    // Only over HTTPS (directly or via a reverse proxy on this machine): a self-hosted server in a LAN runs on plain http.
    secure: res.req.secure,
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.cookieName, { path: '/' });
}

/** Minimal cookie header parser for the Socket.IO handshake. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}
