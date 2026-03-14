/**
 * Server-side Google Drive uploader for poster images.
 * Uses the same JWT service account auth pattern as sheets.ts / docs.ts.
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
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
    throw new Error(`Drive token exchange failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export interface UploadResult {
  fileId: string;
  url: string;       // direct thumbnail/content link
  webLink: string;   // shareable Drive link
}

/**
 * Upload a file to Google Drive.
 * Returns the file ID and public URLs.
 */
export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
  email: string,
  privateKey: string
): Promise<UploadResult> {
  const token = await getAccessToken(email, privateKey);

  // Multipart upload: metadata + file content
  const boundary = 'drive_upload_boundary_' + Date.now();
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const bodyParts = [
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadata,
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${mimeType}\r\n`,
    'Content-Transfer-Encoding: base64\r\n\r\n',
    fileBuffer.toString('base64'),
    `\r\n--${boundary}--`,
  ];

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyParts.join(''),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const fileId = data.id;

  // Transfer ownership to the folder owner so they manage the file
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?transferOwnership=true&sendNotificationEmail=false`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'owner',
      type: 'user',
      emailAddress: 'advantagelucyofficial@gmail.com',
    }),
  });

  // Make the file publicly readable
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });

  return {
    fileId,
    url: `https://lh3.googleusercontent.com/d/${fileId}`,
    webLink: data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
  };
}
