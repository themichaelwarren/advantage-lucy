/**
 * Server-side Google Docs fetcher for song lyrics.
 * Reuses the same JWT auth as the Sheets fetcher.
 */

const SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function base64url(input: string | Uint8Array): string {
  const str = typeof input === 'string' ? input : String.fromCharCode(...input);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJwt(email: string, key: string): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iss: email,
      scope: SCOPES,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const textToSign = `${header}.${payload}`;
  const encoder = new TextEncoder();

  const pemBody = key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

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
    encoder.encode(textToSign)
  );

  return `${textToSign}.${base64url(new Uint8Array(signature))}`;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const jwt = await createJwt(email, privateKey);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Docs token exchange failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

/**
 * Fetch the plain text content of a Google Doc.
 * Extracts text from the document body, preserving paragraph breaks.
 */
export async function fetchDocText(
  docId: string,
  email: string,
  privateKey: string
): Promise<string> {
  const token = await getAccessToken(email, privateKey);
  const url = `https://docs.googleapis.com/v1/documents/${docId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Docs API error: ${res.status} ${err}`);
  }

  const doc = await res.json();
  return extractText(doc);
}

/**
 * Create a blank Google Doc in the specified folder.
 * Returns the new document ID.
 */
export async function createDoc(
  title: string,
  folderId: string,
  email: string,
  privateKey: string
): Promise<string> {
  const token = await getAccessToken(email, privateKey);

  // Create a Google Doc directly in the target folder via Drive API
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Drive create error: ${createRes.status} ${err}`);
  }

  const file = await createRes.json();
  return file.id;
}

interface DocElement {
  paragraph?: {
    elements: Array<{
      textRun?: { content: string };
    }>;
  };
}

function extractText(doc: { body?: { content?: DocElement[] } }): string {
  if (!doc.body?.content) return '';

  const lines: string[] = [];
  for (const block of doc.body.content) {
    if (block.paragraph) {
      const line = block.paragraph.elements
        .map(el => el.textRun?.content || '')
        .join('');
      lines.push(line);
    }
  }

  // Google Docs uses \v (\x0b) for soft line breaks (Shift+Enter within a paragraph).
  // \n appears at the end of each paragraph (hard return).
  // Treat single hard returns the same as soft returns (tight break); only an
  // *empty* paragraph between content (two returns in a row) becomes a stanza break.
  return lines
    .map(l => l.replace(/\n$/, '').replace(/\v/g, '\n'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
