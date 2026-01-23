import express from 'express';
import { fileURLToPath } from 'url';
import { htmlHandler } from './html.js';
import { markdownHandler } from './markdown.js';
import { imageHandler } from './image.js';
import { streamHandler } from './stream.js';
import { fetchHandler } from './fetch.js';

const app = express();
const port = process.env.PORT || 3000;

app.get('/html', htmlHandler);
app.get('/markdown', markdownHandler);
app.get('/image', imageHandler);
app.get('/stream', streamHandler);
app.get('/fetch', fetchHandler);

// Start the server if this is the main module
const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
let server;
if (isMainModule) {
  console.log('Process PID:', process.pid);
  server = app.listen(port, () => {
    console.log(`Renderer service listening on http://localhost:${port}`);
  });

  // Graceful shutdown for Docker
  function shutdown(signal) {
    console.log(`Received shutdown signal (${signal}), closing server...`);
    server.close(() => {
      console.log('Server closed. Exiting process.');
      process.exit(0);
    });
    // Force exit if not closed in 2 seconds
    setTimeout(() => {
      console.error('Force exiting after 2s');
      process.exit(1);
    }, 2000);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('exit', (code) => {
    console.log('Process exit event with code:', code);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

export { app };
