import http from 'http';

// Convert Node.js request to fetch Request
export const nodeToFetchRequest = async (req: http.IncomingMessage): Promise<Request> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);

  return new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method,
    headers: new Headers(req.headers as Record<string, string>),
    body: body.length > 0 ? body : null,
  });
};

// Convert fetch Response to Node.js response
export const fetchToNodeResponse = async (fetchResponse: Response, res: http.ServerResponse, corsHeaders: Record<string, string>) => {
  res.statusCode = fetchResponse.status;

  // Add CORS headers to all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Add original response headers
  fetchResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (fetchResponse.body) {
    const reader = fetchResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}; 