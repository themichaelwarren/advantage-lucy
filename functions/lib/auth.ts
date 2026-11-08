/**
 * Shared JWT / OAuth2 auth for Google APIs on Cloudflare Workers.
 * Uses Web Crypto API — no Node.js dependencies.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function base64url(input: string | Uint8Array): string {
  const str = typeof input === 'string' ? input : String.fromCharCode(...input);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The base64 body of a PEM private key. Forgiving about how the secret was
 * pasted: surrounding quotes, a "NAME=" prefix, "\n" written as text, or the
 * whole service-account JSON. Only what is between BEGIN and END is used.
 */
export function pemKeyBody(key: string): string {
  const text = key.replace(/\\n/g, '\n');
  const m = text.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  return (m ? m[1] : text).replace(/[^A-Za-z0-9+/=]/g, '');
}

async function createJwt(email: string, key: string, scope: string): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({ iss: email, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );

  const textToSign = `${header}.${payload}`;
  const pemBody = pemKeyBody(key);
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
    new TextEncoder().encode(textToSign)
  );

  return `${textToSign}.${base64url(new Uint8Array(signature))}`;
}

// Per-scope token cache (Workers globals persist across requests within an isolate)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getAccessToken(
  email: string,
  privateKey: string,
  scope: string
): Promise<string> {
  const cached = tokenCache.get(scope);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const jwt = await createJwt(email, privateKey, scope);
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
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  const data: any = await res.json();
  tokenCache.set(scope, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  });
  return data.access_token;
}
