import fetch from 'node-fetch';
import { convertGoogleDriveUrl } from './lib.js';
import { copyProxyResponseHeaders } from './proxy-headers.js';

const STREAM_FETCH_HEADERS = {
  'accept-encoding': 'identity',
};

export async function streamHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }
  try {
    const response = await fetch(convertGoogleDriveUrl(url), {
      headers: STREAM_FETCH_HEADERS,
    });
    // Copy status and headers
    res.status(response.status);
    copyProxyResponseHeaders(response.headers, res);

    // Stream the response body
    if (response.body) {
      await writeStreamResponse(response.body, res);
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

async function writeStreamResponse(body, res) {
  try {
    for await (const chunk of body) {
      if (!res.write(chunk)) {
        await new Promise((resolve) => res.once('drain', resolve));
      }
    }
    if (!res.writableEnded) {
      res.end();
    }
  } catch (err) {
    console.error('Upstream stream failed in /stream:', err);
    if (!res.headersSent) {
      res.status(500);
      res.end('Error proxying content');
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}
