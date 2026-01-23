import fetch from 'node-fetch';
import { pipeline } from 'stream';

export async function streamHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }
  try {
    const response = await fetch(url);
    // Copy status and headers
    res.status(response.status);

    // Set default content type if not present
    const contentType = response.headers.get('content-type') || 'text/plain';
    res.setHeader('Content-Type', contentType);

    // Copy other headers
    for (const [key, value] of response.headers.entries()) {
      if (
        key.toLowerCase() !== 'transfer-encoding' &&
        key.toLowerCase() !== 'content-encoding' &&
        key.toLowerCase() !== 'content-length'
      ) {
        res.setHeader(key, value);
      }
    }

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
