import { readFileSync } from 'node:fs';
import { prisma } from '../db';

/**
 * Creates all tables when the database is empty. The bundled server ships without the Prisma CLI,
 * so instead of `prisma db push` it runs the SQL generated at build time (`npm run bundle`).
 * Returns true when the tables were created.
 */
export async function ensureSchema(schemaFile: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ n: number | bigint }[]>(
    "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'User'",
  );
  if (Number(rows[0]?.n ?? 0) > 0) return false;
  const statements = readFileSync(schemaFile, 'utf8')
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
  await prisma.$transaction(statements.map((s) => prisma.$executeRawUnsafe(s)));
  return true;
}
