/**
 * Google Docs fetcher for Cloudflare Workers.
 */
import { getAccessToken } from './auth';

const SCOPE = 'https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/drive.readonly';

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
  return lines
    .map((l: string) => l.replace(/\n$/, '').replace(/\v/g, '\n'))
    .join('\n\n')
    .trim();
}
