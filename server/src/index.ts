import { createServer } from 'node:http';
import { seedDemo } from '../prisma/demoSeed';
import { createApp } from './app';
import { config } from './config';
import { ensureSchema } from './lib/bootstrap';
import { removeStalePendingFiles } from './lib/files';
import { createSocketServer } from './socket';

if (config.schemaFile && (await ensureSchema(config.schemaFile))) console.log('Created database tables');
if (config.seedDemo) await seedDemo();

const httpServer = createServer(createApp());
createSocketServer(httpServer);

// Attachments that were uploaded but never sent.
const cleanUp = () => void removeStalePendingFiles().catch((err) => console.error('File clean-up failed', err));
cleanUp();
setInterval(cleanUp, 60 * 60 * 1000).unref();

httpServer.listen(config.port, config.host, () => {
  console.log(`Hallo listening on http://localhost:${config.port}`);
  // The desktop app starts the server as a child process and waits for this message.
  process.send?.({ type: 'listening', port: config.port });
});
