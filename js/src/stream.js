import fetch from 'node-fetch';
import { pipeline } from 'stream';
import { convertGoogleDriveUrl } from './lib.js';
import { copyProxyResponseHeaders } from './proxy-headers.js';

export async function streamHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }
  try {
    const response = await fetch(convertGoogleDriveUrl(url));
    // Copy status and headers
    res.status(response.status);
    copyProxyResponseHeaders(response.headers, res, {
      preserveContentLength: true,
    });

    // Stream the response body
    if (response.body) {
      pipeline(response.body, res, (err) => {
        if (err) {
          console.error('Pipeline error in /stream:', err);
          if (!res.headersSent) {
            res.status(500);
            res.end('Error proxying content');
          }
        }
      });
    } else {
      res.end();
    }
  } catch (err) {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.status(500);
      res.end('Error proxying content');
    }
  }
}
