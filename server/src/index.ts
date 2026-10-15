import { createServer } from 'node:http';
import { createApp } from './app';
import { config } from './config';
import { removeStalePendingFiles } from './lib/files';
import { createSocketServer } from './socket';

const httpServer = createServer(createApp());
createSocketServer(httpServer);

// Attachments that were uploaded but never sent.
const cleanUp = () => void removeStalePendingFiles().catch((err) => console.error('File clean-up failed', err));
cleanUp();
setInterval(cleanUp, 60 * 60 * 1000).unref();

httpServer.listen(config.port, () => {
  console.log(`Hallo API listening on http://localhost:${config.port}`);
});
