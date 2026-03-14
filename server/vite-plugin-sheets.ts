/**
 * Vite dev server plugin that exposes /api/sheets/* and /api/docs/*.
 * Keeps the service account key server-side.
 */
import type { Plugin } from 'vite';
import { fetchEvents, fetchAlbums, fetchTracklists, fetchSongs, fetchSetlists, fetchVenues, fetchAreas, fetchPrefectures, fetchCountries, appendRow, updateRow, deleteRow, fetchHeaders } from './sheets';
import { fetchDocText } from './docs';
import { uploadToDrive } from './drive';

export default function sheetsPlugin(): Plugin {
  return {
    name: 'sheets-api',
    configureServer(server) {
      // Sheets API routes
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/sheets')) return next();

        const sheetId = process.env.VITE_GOOGLE_SHEET_ID;
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!sheetId || !email || !privateKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Missing Google Sheets env vars' }));
          return;
        }

        try {
          let data: unknown;

          if (req.url.startsWith('/api/sheets/events')) {
            data = await fetchEvents(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/albums')) {
            data = await fetchAlbums(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/tracklists')) {
            data = await fetchTracklists(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/songs')) {
            data = await fetchSongs(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/setlists')) {
            data = await fetchSetlists(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/venues')) {
            data = await fetchVenues(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/areas')) {
            data = await fetchAreas(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/prefectures')) {
            data = await fetchPrefectures(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/countries')) {
            data = await fetchCountries(sheetId, email, privateKey);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (err) {
          console.error('[sheets-api]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // Admin write routes: POST/PUT/DELETE /api/admin/:tab
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/admin\/([a-zA-Z]+)/);
        if (!match) return next();

        const tab = match[1]; // e.g. "Events", "Venues"
        const sheetId = process.env.VITE_GOOGLE_SHEET_ID;
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!sheetId || !email || !privateKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Missing Google Sheets env vars' }));
          return;
        }

        // Parse JSON body for POST/PUT
        let body: Record<string, unknown> = {};
        if (req.method === 'POST' || req.method === 'PUT') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          body = JSON.parse(Buffer.concat(chunks).toString());
        }

        try {
          if (req.method === 'GET') {
            // GET /api/admin/:tab/headers → column headers
            if (req.url?.includes('/headers')) {
              const headers = await fetchHeaders(sheetId, tab, email, privateKey);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ headers }));
              return;
            }
          }

          if (req.method === 'POST') {
            const fields = body.fields as Record<string, string>;
            const range = await appendRow(sheetId, tab, fields, email, privateKey);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, range }));
            return;
          }

          if (req.method === 'PUT') {
            const id = body.id as string;
            const fields = body.fields as Record<string, string>;
            await updateRow(sheetId, tab, id, fields, email, privateKey);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (req.method === 'DELETE') {
            // id from query string: /api/admin/Events?id=xxx
            const url = new URL(req.url!, `http://${req.headers.host}`);
            const id = url.searchParams.get('id');
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing id parameter' }));
              return;
            }
            await deleteRow(sheetId, tab, id, email, privateKey);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        } catch (err) {
          console.error('[admin-api]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // Docs API route: GET /api/docs/:docId → plain text lyrics
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/docs\/([a-zA-Z0-9_-]+)/);
        if (!match) return next();

        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!email || !privateKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Missing Google auth env vars' }));
          return;
        }

        try {
          const text = await fetchDocText(match[1], email, privateKey);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ text }));
        } catch (err) {
          console.error('[docs-api]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      // Upload route: POST /api/upload → upload file to Google Drive
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/upload' || req.method !== 'POST') return next();

        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        if (!email || !privateKey || !folderId) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Missing Drive env vars (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID)' }));
          return;
        }

        try {
          // Parse multipart form data manually (single file field)
          const contentType = req.headers['content-type'] || '';
          const boundaryMatch = contentType.match(/boundary=(.+)/);
          if (!boundaryMatch) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing multipart boundary' }));
            return;
          }

          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const rawBody = Buffer.concat(chunks);

          const boundary = boundaryMatch[1];
          const { fileName, mimeType, fileBuffer } = parseMultipart(rawBody, boundary);

          if (!fileBuffer || !fileName) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'No file found in upload' }));
            return;
          }

          const result = await uploadToDrive(fileBuffer, fileName, mimeType, folderId, email, privateKey);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err) {
          console.error('[upload-api]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

/** Simple multipart/form-data parser for a single file field. */
function parseMultipart(body: Buffer, boundary: string): { fileName: string; mimeType: string; fileBuffer: Buffer } {
  const delimiterBuf = Buffer.from(`--${boundary}`);
  let fileName = '';
  let mimeType = 'application/octet-stream';
  let fileBuffer = Buffer.alloc(0);

  // Split by boundary
  const bodyStr = body.toString('binary');
  const parts = bodyStr.split(`--${boundary}`);

  for (const part of parts) {
    if (part === '--\r\n' || part === '--' || part.trim() === '') continue;

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerSection = part.substring(0, headerEnd);
    const fileNameMatch = headerSection.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerSection.match(/Content-Type:\s*(.+)/i);

    if (fileNameMatch) {
      fileName = fileNameMatch[1];
      if (contentTypeMatch) mimeType = contentTypeMatch[1].trim();

      // Extract binary content — we need to work with the Buffer directly
      const headerBytes = Buffer.from(headerSection + '\r\n\r\n', 'binary').length;
      const partStart = body.indexOf(delimiterBuf);

      // Find this part's start in the original buffer
      let offset = 0;
      const parts2 = [];
      let pos = 0;
      while (true) {
        const idx = body.indexOf(delimiterBuf, pos);
        if (idx === -1) break;
        parts2.push(idx);
        pos = idx + delimiterBuf.length;
      }

      // The file content part — find the boundary that starts this section
      for (let i = 0; i < parts2.length; i++) {
        const partOffset = parts2[i] + delimiterBuf.length + 2; // skip \r\n after boundary
        const nextBoundary = i + 1 < parts2.length ? parts2[i + 1] : body.length;

        const partSlice = body.subarray(partOffset, nextBoundary - 2); // -2 for trailing \r\n
        const partHeaderEnd = partSlice.indexOf(Buffer.from('\r\n\r\n'));
        if (partHeaderEnd === -1) continue;

        const partHeaders = partSlice.subarray(0, partHeaderEnd).toString();
        if (partHeaders.includes('filename=')) {
          fileBuffer = Buffer.from(partSlice.subarray(partHeaderEnd + 4));
          break;
        }
      }
      break;
    }
  }

  return { fileName, mimeType, fileBuffer };
}
