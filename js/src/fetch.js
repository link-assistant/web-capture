import fetch from 'node-fetch';
import { convertGoogleDriveUrl } from './lib.js';
import { copyProxyResponseHeaders } from './proxy-headers.js';

export async function fetchHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }
  try {
    const response = await fetch(convertGoogleDriveUrl(url));
    // Copy status and headers
    res.status(response.status);
    copyProxyResponseHeaders(response.headers, res);

    // Get the response body as buffer and send it
    const buffer = await response.buffer();
    res.send(buffer);
  } catch (err) {
    console.error('Fetch error:', err);
    if (!res.headersSent) {
      res.status(500);
      res.end('Error fetching content');
    }
  }
}
