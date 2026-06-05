import fetch from 'node-fetch';

export async function fetchHandler(req, res) {
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
