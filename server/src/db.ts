import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client';
import { config } from './config';

export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: config.databaseUrl }),
});
