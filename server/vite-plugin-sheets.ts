/**
 * Vite dev server plugin that exposes /api/sheets/* and /api/docs/*.
 * Keeps the service account key server-side.
 */
import type { Plugin } from 'vite';
import { fetchEvents, fetchAlbums, fetchTracklists, fetchSongs, fetchPeople, fetchSetlists, fetchNews, fetchBlog, fetchPhotos, fetchVenues, fetchAreas, fetchPrefectures, fetchCountries, appendRow, updateRow, deleteRow, replaceRows, reorderRows, fetchHeaders, clearSheetCache } from './sheets';
import { fetchDocText, createDoc } from './docs';
import { checkAdmin } from '../functions/lib/adminAuth';
import { checkContact, saveMessage, listMessages, setMessageStatus, verifyTurnstile, showForEmail } from '../functions/lib/messages';
import { notifyBand } from '../functions/lib/notify';
import { handleReserveGet, handleReservePost, handleAdminReservations } from '../functions/lib/reservations';
import { handleAdminMedia } from '../functions/lib/media';
import { handleAdminArrangements } from '../functions/lib/arrangements';
import { checkFiles, attachmentNames, isAttachmentName } from '../functions/lib/attachments';
import type { IncomingMessage, ServerResponse } from 'http';
import { publicView } from '../functions/lib/visibility';
import { pageMeta, injectMeta, type Load } from '../functions/lib/meta';
import { fetchInstagramThumb } from '../functions/lib/igThumb';
import { handleAdminFilters } from '../functions/lib/filters';

/** Same admin check as production (functions/lib/adminAuth.ts). Returns false and responds if denied. */
async function requireAdmin(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const check = await checkAdmin(req.headers.authorization, {
    clientId: process.env.VITE_GOOGLE_CLIENT_ID,
    adminEmails: process.env.VITE_ADMIN_EMAILS,
  });
  if (check.ok) return true;
  res.statusCode = check.status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: check.error }));
  return false;
}


export default function sheetsPlugin(): Plugin {
  return {
    name: 'sheets-api',
    // Link-preview tags, as production adds them (functions/lib/pageFunction.ts),
    // so they can be checked locally: curl a page and look at <head>
    async transformIndexHtml(html, ctx) {
      const path = (ctx.originalUrl || ctx.path || '/').split('?')[0];
      const sheetId = process.env.VITE_GOOGLE_SHEET_ID;
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (!sheetId || !email || !privateKey) return html;
      const fetchers = { events: fetchEvents, albums: fetchAlbums, tracklists: fetchTracklists, songs: fetchSongs, news: fetchNews, venues: fetchVenues };
      const load: Load = async tab => publicView(tab, await fetchers[tab](sheetId, email, privateKey)) as Record<string, any>[];
      try {
        const origin = `http://${ctx.server?.config.server.host || 'localhost'}:${ctx.server?.config.server.port || 5173}`;
        const meta = await pageMeta(path, origin, load);
        return meta ? injectMeta(html, meta) : html;
      } catch {
        return html;
      }
    },
    configureServer(server) {
      // Media and arrangements (admin only; same code as production: functions/lib/media.ts, arrangements.ts)
      // Instagram post pictures (same code as production: functions/lib/igThumb.ts)
      server.middlewares.use(async (req, res, next) => {
        const code = req.method === 'GET' ? req.url?.match(/^\/api\/ig\/([^/?]+)/)?.[1] : undefined;
        if (!code) return next();
        const out = await fetchInstagramThumb(code);
        res.statusCode = out.status;
        out.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await out.arrayBuffer()));
      });

      server.middlewares.use(async (req, res, next) => {
        const isMedia = req.url?.startsWith('/api/admin/media');
        const isFilters = req.url?.startsWith('/api/admin/filters');
        if (!isMedia && !isFilters && !req.url?.startsWith('/api/admin/arrangements')) return next();
        if (!(await requireAdmin(req, res))) return;
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const request = new Request(new URL(req.url!, `http://${req.headers.host}`), {
          method: req.method,
          headers: { 'content-type': 'application/json' },
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
        });
        const ctx = {
          sheetId: process.env.VITE_GOOGLE_SHEET_ID!,
          saEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
          saKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        };
        const out = isMedia ? await handleAdminMedia(request, ctx) : isFilters ? await handleAdminFilters(request, ctx) : await handleAdminArrangements(request, ctx);
        res.statusCode = out.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(await out.text());
      });

      // Ticket reservations (same code as production: functions/lib/reservations.ts)
      server.middlewares.use(async (req, res, next) => {
        const isPublic = req.url?.startsWith('/api/reserve') && (req.method === 'GET' || req.method === 'POST');
        const isAdmin = req.url?.startsWith('/api/admin/reservations');
        if (!isPublic && !isAdmin) return next();
        if (isAdmin && !(await requireAdmin(req, res))) return;
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const request = new Request(url, {
          method: req.method,
          headers: { 'content-type': String(req.headers['content-type'] || 'application/json') },
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
        });
        const ctx = {
          sheetId: process.env.VITE_GOOGLE_SHEET_ID!,
          saEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
          saKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
          env: process.env,
          siteUrl: process.env.SITE_URL || `http://${req.headers.host}`,
        };
        try {
          const out = isAdmin
            ? await handleAdminReservations(request, ctx)
            : req.method === 'GET' ? await handleReserveGet(url, ctx) : await handleReservePost(request, ctx, null);
          res.statusCode = out.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(await out.text());
        } catch (err) {
          console.error('[reserve]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'server' }));
        }
      });

      // Contact form + admin message list (same code as production: functions/lib/messages.ts)
      server.middlewares.use(async (req, res, next) => {
        const isContact = req.url === '/api/contact' && req.method === 'POST';
        const isList = req.url?.startsWith('/api/admin/messages') && req.method === 'GET';
        const isStatus = req.url?.startsWith('/api/admin/messages') && req.method === 'PATCH';
        const attachment = req.method === 'GET' ? req.url?.match(/^\/api\/admin\/attachment\/([^/?]+)/)?.[1] : undefined;
        if (!isContact && !isList && !isStatus && !attachment) return next();
        // Dev only: attached photos are kept in a local, git-ignored folder
        const fs = await import('fs');
        const path = await import('path');
        const devDir = path.resolve('.dev-submissions');
        if (attachment) {
          if (!(await requireAdmin(req, res))) return;
          const file = path.join(devDir, attachment);
          if (!isAttachmentName(attachment) || !fs.existsSync(file)) { res.statusCode = 404; res.end('Not found'); return; }
          const ext = attachment.split('.').pop();
          res.setHeader('Content-Type', ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(fs.readFileSync(file));
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        const sheetId = process.env.VITE_GOOGLE_SHEET_ID!;
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
        try {
          if (isList) {
            if (!(await requireAdmin(req, res))) return;
            res.end(JSON.stringify({ messages: await listMessages(sheetId, email, privateKey) }));
            return;
          }
          if (isStatus) {
            if (!(await requireAdmin(req, res))) return;
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const { id, status } = JSON.parse(Buffer.concat(chunks).toString() || '{}');
            await setMessageStatus(sheetId, email, privateKey, id || '', status ?? '');
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks);
          let input;
          let files: File[] = [];
          try {
            if ((req.headers['content-type'] || '').includes('multipart/form-data')) {
              // Let the standard Request parser handle multipart, as on Cloudflare
              const form = await new Request('http://dev/api/contact', { method: 'POST', headers: { 'content-type': req.headers['content-type']! }, body: raw }).formData();
              input = JSON.parse(String(form.get('payload') || '{}'));
              files = form.getAll('files').filter((f): f is File => typeof f !== 'string');
            } else {
              input = JSON.parse(raw.toString() || '{}');
            }
          } catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'bad_request' })); return; }
          const checked = checkContact(input);
          if (!checked.ok) { res.statusCode = 400; res.end(JSON.stringify({ error: checked.error, field: checked.field })); return; }
          if (checked.spam) { res.end(JSON.stringify({ ok: true })); return; }
          if (!(await verifyTurnstile(process.env.TURNSTILE_SECRET, input.turnstile_token))) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'verify' })); return;
          }
          const fileCheck = await checkFiles(files);
          if (!fileCheck.ok) { res.statusCode = 400; res.end(JSON.stringify({ error: fileCheck.error, field: 'files' })); return; }
          if (fileCheck.files.length) {
            const names = attachmentNames(checked.message.id, fileCheck.files);
            fs.mkdirSync(devDir, { recursive: true });
            fileCheck.files.forEach((f, i) => fs.writeFileSync(path.join(devDir, names[i]), f.bytes));
            checked.message.attachments = names.join(',');
          }
          const ctx = {
            siteUrl: process.env.SITE_URL || `http://${req.headers.host}`,
            show: checked.message.topic === 'setlist' ? await showForEmail(sheetId, email, privateKey, checked.message.event) : undefined,
          };
          const notified = await notifyBand(process.env, checked.message, ctx).catch(err => { console.error('[contact] email failed:', err); return false; });
          await saveMessage(sheetId, email, privateKey, checked.message, notified ? 'yes' : 'no');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          console.error('[contact]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'server' }));
        }
      });

      // Sheets API routes
      // /api/sheets/:tab is the public view (hidden, scheduled and not-yet-public
      // setlists removed, as in production); /api/admin/sheets/:tab is the full
      // data for the admin. Dev only: admin reads don't need sign-in here, so
      // the ?preview-admin screens still show data (this server is local).
      server.middlewares.use(async (req, res, next) => {
        const isAdminRead = !!req.url?.startsWith('/api/admin/sheets/');
        if (!req.url?.startsWith('/api/sheets') && !isAdminRead) return next();
        if (isAdminRead) req.url = req.url!.replace('/api/admin/sheets/', '/api/sheets/');

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
          } else if (req.url.startsWith('/api/sheets/people')) {
            data = await fetchPeople(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/setlists')) {
            data = await fetchSetlists(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/news')) {
            data = await fetchNews(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/blog')) {
            data = await fetchBlog(sheetId, email, privateKey);
          } else if (req.url.startsWith('/api/sheets/photos')) {
            data = await fetchPhotos(sheetId, email, privateKey);
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

          if (!isAdminRead) {
            const tab = req.url.replace('/api/sheets/', '').split(/[/?]/)[0].toLowerCase();
            const events = tab === 'setlists' ? await fetchEvents(sheetId, email, privateKey) : undefined;
            data = publicView(tab, data, events as never);
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (err) {
          console.error('[sheets-api]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // GET /api/admin/whoami: is this token an admin? (same check as production)
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/admin/whoami' || req.method !== 'GET') return next();
        if (!(await requireAdmin(req, res))) return;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      });

      // Admin write routes: POST/PUT/DELETE /api/admin/:tab
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/admin\/([a-zA-Z]+)/);
        if (!match) return next();

        if (!(await requireAdmin(req, res))) return;

        const tab = match[1]; // e.g. "Events", "Venues"
        // Any write invalidates the read cache so the change shows at once
        if (req.method !== 'GET') clearSheetCache();
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
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
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

          // POST /api/admin/:tab/order {ids} → put the rows in that order
          if (req.method === 'POST' && /^\/api\/admin\/[a-zA-Z]+\/order/.test(req.url || '')) {
            await reorderRows(sheetId, tab, (body.ids as string[]).map(String), email, privateKey);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            return;
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

          if (req.method === 'PATCH') {
            // Bulk replace: delete all rows where col A = key, then append new rows
            const key = body.key as string;
            const rows = body.rows as Record<string, string>[];
            await replaceRows(sheetId, tab, key, rows, email, privateKey);
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
      // Create Doc route: POST /api/docs → create a blank Google Doc in lyrics folder
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/docs' || req.method !== 'POST') return next();
        if (!(await requireAdmin(req, res))) return;

        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const folderId = process.env.VITE_LYRICS_FOLDER_ID;

        if (!email || !privateKey || !folderId) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Missing Google auth or folder env vars' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const docId = await createDoc(body.title, folderId, email, privateKey);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ docId }));
        } catch (err) {
          console.error('[docs-create]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // Upload route: POST /api/upload → proxy to production R2 + save locally for dev serving
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/upload' || req.method !== 'POST') return next();
        if (!(await requireAdmin(req, res))) return;

        try {
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

          // Proxy upload to production R2 via the Cloudflare Pages function
          const formData = new FormData();
          formData.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);
          // Pass the admin's sign-in through: production checks it too
          const prodRes = await fetch('https://new.advantagelucy.com/api/upload', {
            method: 'POST',
            headers: req.headers.authorization ? { Authorization: req.headers.authorization } : undefined,
            body: formData,
          });

          if (!prodRes.ok) {
            const err = await prodRes.text();
            throw new Error(`Production upload failed: ${prodRes.status} ${err}`);
          }

          const prodData = await prodRes.json() as { url: string; key: string };

          // Also save locally so dev image serving works without proxying
          const fs = await import('fs');
          const path = await import('path');
          const uploadsDir = path.resolve('public/uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          fs.writeFileSync(path.join(uploadsDir, prodData.key), fileBuffer);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(prodData));
        } catch (err) {
          console.error('[upload-api]', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // Serve uploaded images in dev: GET /api/images/:key
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/images\/(.+)/);
        if (!match) return next();

        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.resolve('public/uploads', match[1]);
        if (!fs.existsSync(filePath)) {
          // Proxy to production R2 if not found locally
          try {
            const prodRes = await fetch(`https://new.advantagelucy.com/api/images/${match[1]}`);
            if (prodRes.ok) {
              res.setHeader('Content-Type', prodRes.headers.get('content-type') || 'image/jpeg');
              res.setHeader('Cache-Control', 'public, max-age=31536000');
              const buffer = Buffer.from(await prodRes.arrayBuffer());
              res.end(buffer);
              return;
            }
          } catch {}
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        const data = fs.readFileSync(filePath);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.end(data);
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
