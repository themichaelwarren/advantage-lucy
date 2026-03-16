/**
 * Cloudflare Email Worker — receives emails, extracts Instagram URLs,
 * and appends them as draft blog posts to the Google Sheet.
 *
 * Setup:
 *   1. Deploy: cd workers/blog-ingest && npx wrangler deploy
 *   2. Set secrets: wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
 *                   wrangler secret put GOOGLE_PRIVATE_KEY
 *                   wrangler secret put VITE_GOOGLE_SHEET_ID
 *   3. Cloudflare Dashboard → Email Routing → route blog@advantagelucy.com → this Worker
 */

interface Env {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  VITE_GOOGLE_SHEET_ID: string;
}

// ---------- Google Auth (inlined from functions/lib/auth.ts) ----------

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function base64url(input: string | Uint8Array): string {
  const str = typeof input === 'string' ? input : String.fromCharCode(...input);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );

  const textToSign = `${header}.${payload}`;
  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(textToSign)
  );

  const jwt = `${textToSign}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data: any = await res.json();
  return data.access_token;
}

// ---------- Sheets append ----------

async function appendRow(
  sheetId: string,
  token: string,
  values: string[]
): Promise<void> {
  const range = encodeURIComponent('Blog!A:A');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets append error: ${res.status} ${err}`);
  }
}

// ---------- Instagram URL extraction ----------

const INSTAGRAM_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\/?/g;

interface InstaPost {
  url: string;
  shortcode: string;
}

function extractInstagramPosts(text: string): InstaPost[] {
  const seen = new Set<string>();
  const posts: InstaPost[] = [];
  let match;
  while ((match = INSTAGRAM_RE.exec(text)) !== null) {
    const shortcode = match[1];
    if (!seen.has(shortcode)) {
      seen.add(shortcode);
      posts.push({ url: match[0], shortcode });
    }
  }
  return posts;
}

// ---------- Email handler ----------

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    try {
      // Read email body
      const reader = message.raw.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const rawEmail = new TextDecoder().decode(
        new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))
          .map((_, i) => {
            let offset = 0;
            for (const chunk of chunks) {
              if (i < offset + chunk.length) return chunk[i - offset];
              offset += chunk.length;
            }
            return 0;
          })
      );

      const posts = extractInstagramPosts(rawEmail);
      if (posts.length === 0) {
        console.log(`No Instagram URLs found in email from ${message.from}`);
        return;
      }

      const privateKey = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
      const token = await getAccessToken(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey);
      const today = new Date().toISOString().slice(0, 10);

      // Append each URL as a separate draft post (shortcode as ID)
      for (const post of posts) {
        // Columns: id, instagram_url, date, title_en, title_ja, status
        await appendRow(env.VITE_GOOGLE_SHEET_ID, token, [
          post.shortcode, post.url, today, '', '', 'private',
        ]);
        console.log(`Added draft blog post: ${post.shortcode} → ${post.url}`);
      }
    } catch (err) {
      console.error('Blog ingest error:', err);
    }
  },
};
