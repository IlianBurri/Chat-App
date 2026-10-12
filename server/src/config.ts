import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET ?? (isProd ? undefined : 'dev-secret-change-me');
if (!jwtSecret) throw new Error('JWT_SECRET must be set in production');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  jwtSecret,
  isProd,
  cookieName: 'session',
  sessionDays: 7,
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
};
