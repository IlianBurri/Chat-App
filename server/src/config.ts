import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET ?? (isProd ? undefined : 'dev-secret-change-me');
if (!jwtSecret) throw new Error('JWT_SECRET must be set in production');

/**
 * STUN/TURN servers for calls, as JSON (e.g. [{"urls":"stun:stun.example.org:3478"}]).
 * Not needed on one machine or in a LAN; across networks a STUN (and often a TURN) server is required.
 */
function parseIceServers(value: string | undefined): { urls: string | string[]; username?: string; credential?: string }[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error('ICE_SERVERS must be a JSON array');
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  jwtSecret,
  isProd,
  cookieName: 'session',
  sessionDays: 7,
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  iceServers: parseIceServers(process.env.ICE_SERVERS),
  /** How long an incoming call rings before it counts as missed */
  ringMs: Number(process.env.CALL_RING_SECONDS ?? 30) * 1000,
};
