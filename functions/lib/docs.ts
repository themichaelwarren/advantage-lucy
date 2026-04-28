/**
 * Google Docs fetcher for Cloudflare Workers.
 */
import { getAccessToken } from './auth';

const SCOPE = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive';

export async function fetchDocText(docId: string, email: string, privateKey: string): Promise<string> {
  const token = await getAccessToken(email, privateKey, SCOPE);
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Docs API error: ${res.status} ${err}`);
  }

  const doc: any = await res.json();
  return extractText(doc);
}

export async function createDoc(
  title: string,
  folderId: string,
  email: string,
  privateKey: string
): Promise<string> {
  const token = await getAccessToken(email, privateKey, SCOPE);

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

  const file: any = await createRes.json();
  return file.id;
}

function extractText(doc: any): string {
  if (!doc.body?.content) return '';
  const lines: string[] = [];
  for (const block of doc.body.content) {
    if (block.paragraph) {
      const line = block.paragraph.elements
        .map((el: any) => el.textRun?.content || '')
        .join('');
      lines.push(line);
    }
  }
  // Treat single hard returns the same as soft returns (tight break); only an
  // empty paragraph between content (two returns in a row) becomes a stanza break.
  return lines
    .map((l: string) => l.replace(/\n$/, '').replace(/\v/g, '\n'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
