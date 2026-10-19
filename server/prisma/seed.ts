/** Demo data for development: runs on every `npm run dev`; `--force` seeds even when data exists (used after a reset). */
import { prisma } from '../src/db';
import { seedDemo } from './demoSeed';

seedDemo(process.argv.includes('--force'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
