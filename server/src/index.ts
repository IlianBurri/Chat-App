import { createServer } from 'node:http';
import { createApp } from './app';
import { config } from './config';
import { createSocketServer } from './socket';

const httpServer = createServer(createApp());
createSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`Teamline API listening on http://localhost:${config.port}`);
});
