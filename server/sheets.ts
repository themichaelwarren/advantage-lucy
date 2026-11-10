/**
 * Server-side Google Sheets fetcher.
 * Used by the Vite dev server plugin and can be adapted for Cloudflare Workers in production.
 */
import { normDateTime } from '../functions/lib/visibility';
import type { Event, Album, TracklistEntry, Song, SetlistEntry, Venue, Area, Prefecture, Country, Person, NewsPost, BlogPost, SplashPhoto } from '../src/types';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// JWT creation for service account auth (no external deps)
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

  // Import the PEM private key
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
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

// Dev-only read cache. Google allows 60 Sheets reads/minute; without this,
// clicking around locally (each page reads several tabs) trips the quota.
// Cleared on every admin write so edits show up immediately.
const CACHE_TTL_MS = 30_000;
const sheetCache = new Map<string, { at: number; rows: Promise<string[][]> }>();

export function clearSheetCache() {
  sheetCache.clear();
}

async function fetchSheet(
  sheetId: string,
  range: string,
  email: string,
  privateKey: string
): Promise<string[][]> {
  const key = `${sheetId}|${range}`;
  const hit = sheetCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;
  const rows = fetchSheetUncached(sheetId, range, email, privateKey);
  sheetCache.set(key, { at: Date.now(), rows });
  rows.catch(() => sheetCache.delete(key));
  return rows;
}

async function fetchSheetUncached(
  sheetId: string,
  range: string,
  email: string,
  privateKey: string
): Promise<string[][]> {
  const token = await getAccessToken(email, privateKey);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.values || [];
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((key, i) => {
      obj[key] = row[i]?.trim() || '';
    });
    return obj;
  });
}

// ---------- Reference tables ----------

export async function fetchCountries(
  sheetId: string, email: string, privateKey: string
): Promise<Country[]> {
  const rows = await fetchSheet(sheetId, 'Countries!A:C', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    name_en: row.name_en,
    name_ja: row.name_ja,
  }));
}

export async function fetchPrefectures(
  sheetId: string, email: string, privateKey: string
): Promise<Prefecture[]> {
  const rows = await fetchSheet(sheetId, 'Prefectures!A:D', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    name_en: row.name_en,
    name_ja: row.name_ja,
    country: row.country,
  }));
}

export async function fetchAreas(
  sheetId: string, email: string, privateKey: string
): Promise<Area[]> {
  const rows = await fetchSheet(sheetId, 'Areas!A:D', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    name_en: row.name_en,
    name_ja: row.name_ja,
    prefecture: row.prefecture,
  }));
}

export async function fetchVenues(
  sheetId: string, email: string, privateKey: string
): Promise<Venue[]> {
  const rows = await fetchSheet(sheetId, 'Venues!A:E', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    name_en: row.name_en,
    name_ja: row.name_ja,
    area: row.area,
    url: row.url || undefined,
  }));
}

// ---------- Events (with venue join) ----------

export async function fetchEvents(
  sheetId: string,
  email: string,
  privateKey: string
): Promise<Event[]> {
  // Fetch events and all reference tables in parallel
  const [eventRows, venues, areas, prefectures, countries] = await Promise.all([
    fetchSheet(sheetId, 'Events', email, privateKey),
    fetchVenues(sheetId, email, privateKey),
    fetchAreas(sheetId, email, privateKey),
    fetchPrefectures(sheetId, email, privateKey),
    fetchCountries(sheetId, email, privateKey),
  ]);

  // Build lookup maps
  const venueMap = new Map(venues.map(v => [v.id, v]));
  const areaMap = new Map(areas.map(a => [a.id, a]));
  const prefMap = new Map(prefectures.map(p => [p.id, p]));
  const countryMap = new Map(countries.map(c => [c.id, c]));

  return rowsToObjects(eventRows)
    .filter(row => row.date) // skip rows without a date
    .map(row => {
      // Resolve venue → area → prefecture → country
      const venue = venueMap.get(row.venue);
      const area = venue ? areaMap.get(venue.area) : undefined;
      const pref = area ? prefMap.get(area.prefecture) : undefined;
      const country = pref ? countryMap.get(pref.country) : undefined;

      return {
        id: row.id,
        title_en: row.title_en,
        title_ja: row.title_ja,
        date: row.date,
        end_date: row.end_date || undefined,
        doors: row.doors || undefined,
        start: row.start || undefined,
        end_time: row.end || undefined,
        adv_price: row.adv_price || undefined,
        door_price: row.door_price || undefined,
        venue_id: row.venue || undefined,
        venue_en: venue?.name_en || row.venue || '',
        venue_ja: venue?.name_ja || row.venue || '',
        venue_url: venue?.url || undefined,
        city_en: area?.name_en || '',
        city_ja: area?.name_ja || '',
        prefecture_en: pref?.name_en || undefined,
        prefecture_ja: pref?.name_ja || undefined,
        country_en: country?.name_en || undefined,
        country_ja: country?.name_ja || undefined,
        ticketUrl: row.ticket_url || undefined,
        performers: row.performers || undefined,
        posterUrl: row.poster_url || undefined,
        featured: row.featured === 'TRUE' || row.featured === 'true',
        status: row.status || 'published',
        body_en: row.body_en || undefined,
        body_ja: row.body_ja || undefined,
        setlist_at: normDateTime(row.setlist_at) || undefined,
        reserve: row.reserve === 'TRUE' || row.reserve === 'true',
        reserve_cap: row.reserve_cap || undefined,
        reserve_max: row.reserve_max || undefined,
        reserve_until: normDateTime(row.reserve_until) || undefined,
      };
    });
}

export async function fetchAlbums(
  sheetId: string,
  email: string,
  privateKey: string
): Promise<Album[]> {
  const rows = await fetchSheet(sheetId, 'Albums!A:L', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    title: row.title,
    date: row.date || undefined,
    year: row.year,
    type: row.type,
    number: row.number || undefined,
    format: row.format || undefined,
    label: row.label || undefined,
    coverUrl: row.artwork_url || undefined,
    listenUrl: row.listen_url || undefined,
    description_en: row.description_en || undefined,
    description_ja: row.description_ja || undefined,
  }));
}

export async function fetchTracklists(
  sheetId: string,
  email: string,
  privateKey: string
): Promise<TracklistEntry[]> {
  const rows = await fetchSheet(sheetId, 'Tracklists!A:C', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    release: row.release,
    track: parseInt(row.track, 10) || 0,
    title: row.title,
  }));
}

export async function fetchSongs(
  sheetId: string,
  email: string,
  privateKey: string
): Promise<Song[]> {
  const rows = await fetchSheet(sheetId, 'Songs', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    title: row.title,
    music_by: row.music_by || undefined,
    lyrics_by: row.lyrics_by || undefined,
    lyrics_doc_id: row.lyrics_doc_id || undefined,
    original_artist: row.original_artist || undefined,
  }));
}

export async function fetchPeople(
  sheetId: string,
  email: string,
  privateKey: string
): Promise<Person[]> {
  const rows = await fetchSheet(sheetId, 'People!A:E', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    name_family_en: row.name_family_en || '',
    name_given_en: row.name_given_en || '',
    name_family_ja: row.name_family_ja || '',
    name_given_ja: row.name_given_ja || '',
  }));
}

export async function fetchSetlists(
  sheetId: string,
  email: string,
  privateKey: string
): Promise<SetlistEntry[]> {
  const rows = await fetchSheet(sheetId, 'Setlists!A:F', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    event: row.event,
    song: row.song,
    set: row.set || '1',
    order: parseInt(row.order, 10) || 0,
    notes: row.notes || undefined,
    status: row.status || 'published',
  }));
}

export async function fetchNews(
  sheetId: string,
  email: string,
  privateKey: string
): Promise<NewsPost[]> {
  const rows = await fetchSheet(sheetId, 'News', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    date: row.date,
    title_en: row.title_en || '',
    title_ja: row.title_ja || '',
    body_en: row.body_en || undefined,
    body_ja: row.body_ja || undefined,
    image_url: row.image_url || undefined,
    status: row.status || 'published',
    publish_at: normDateTime(row.publish_at) || undefined,
  }));
}

export async function fetchBlog(
  sheetId: string,
  email: string,
  privateKey: string
): Promise<BlogPost[]> {
  const rows = await fetchSheet(sheetId, 'Blog', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    instagram_url: row.instagram_url || '',
    date: row.date,
    title_en: row.title_en || '',
    title_ja: row.title_ja || '',
    status: row.status || 'published',
    publish_at: normDateTime(row.publish_at) || undefined,
  }));
}

export async function fetchPhotos(
  sheetId: string,
  email: string,
  privateKey: string
): Promise<SplashPhoto[]> {
  const rows = await fetchSheet(sheetId, 'Photos', email, privateKey);
  return rowsToObjects(rows).map(row => ({
    id: row.id,
    image_url: row.image_url || '',
    caption_en: row.caption_en || undefined,
    caption_ja: row.caption_ja || undefined,
    status: row.status || 'published',
    profile_photo: row.profile_photo || undefined,
    link: (row.link || '').trim() || undefined,
  }));
}

// ========== WRITE OPERATIONS ==========

/** Convert a 1-based column number to a letter (1=A, 26=Z, 27=AA, etc.). */
function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/** Map a fields object to a positional values array using the sheet's header row. */
/**
 * Columns added after the sheet was first set up. If a save fills one in
 * and the tab doesn't have that heading yet, the heading is added (next
 * free column) instead of the value being silently dropped. Only these
 * known names, never arbitrary fields.
 */
const OPTIONAL_COLUMNS: Record<string, string[]> = {
  Songs: ['original_artist'],
  Events: ['setlist_at', 'reserve', 'reserve_cap', 'reserve_max', 'reserve_until'],
  News: ['publish_at'],
  Blog: ['publish_at'],
  Photos: ['link'],
};

/** Make sure a tab is at least `columns` wide (new tabs are often exactly as wide as their headings). */
async function widenTab(sheetId: string, tab: string, columns: number, token: string): Promise<void> {
  const meta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(sheetId,title,gridProperties.columnCount)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!meta.ok) throw new Error(`Failed to get sheet metadata: ${meta.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheet = ((await meta.json()) as any).sheets?.find((x: any) => x.properties.title === tab)?.properties;
  if (!sheet) throw new Error(`Tab "${tab}" not found`);
  const have = sheet.gridProperties?.columnCount ?? 0;
  if (have >= columns) return;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ appendDimension: { sheetId: sheet.sheetId, dimension: 'COLUMNS', length: columns - have } }] }),
  });
  if (!res.ok) throw new Error(`Couldn't widen ${tab}: ${res.status} ${await res.text()}`);
}

async function ensureColumns(
  sheetId: string,
  tab: string,
  fields: Record<string, string>,
  email: string,
  privateKey: string
): Promise<string[]> {
  const headers = await fetchHeaders(sheetId, tab, email, privateKey);
  const missing = (OPTIONAL_COLUMNS[tab] || []).filter(c => fields[c]?.trim() && !headers.includes(c));
  if (!missing.length) return headers;
  const token = await getAccessToken(email, privateKey);
  const from = headers.length + 1;
  await widenTab(sheetId, tab, from + missing.length - 1, token);
  const range = encodeURIComponent(`${tab}!${colLetter(from)}1:${colLetter(from + missing.length - 1)}1`);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [missing] }),
  });
  if (!res.ok) throw new Error(`Couldn't add column ${missing.join(', ')} to ${tab}: ${res.status} ${await res.text()}`);
  clearSheetCache();
  return [...headers, ...missing];
}

async function fieldsToRow(
  sheetId: string,
  tab: string,
  fields: Record<string, string>,
  email: string,
  privateKey: string
): Promise<string[]> {
  const headers = await ensureColumns(sheetId, tab, fields, email, privateKey);
  return headers.map(h => fields[h] ?? '');
}

/** Append a row to a sheet tab. Returns the updated range. */
export async function appendRow(
  sheetId: string,
  tab: string,
  fields: Record<string, string>,
  email: string,
  privateKey: string
): Promise<string> {
  // Same rule as the live site: tabs with an id column need one on every row
  const headers = await fetchHeaders(sheetId, tab, email, privateKey);
  if (headers.includes('id') && !fields.id?.trim()) throw new Error(`New ${tab} rows need an ID`);
  const values = await fieldsToRow(sheetId, tab, fields, email, privateKey);
  const token = await getAccessToken(email, privateKey);
  const range = encodeURIComponent(`${tab}!A:A`);
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
  const data = await res.json();
  return data.updates?.updatedRange || '';
}

/** Find the 1-based row index where column A matches the given id. Returns -1 if not found. */
async function findRowIndex(
  sheetId: string,
  tab: string,
  id: string,
  email: string,
  privateKey: string
): Promise<number> {
  const rows = await fetchSheet(sheetId, `${tab}!A:A`, email, privateKey);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]?.trim() === id) return i + 1; // 1-based (row 1 = header)
  }
  return -1;
}

/** Update an existing row identified by its id (column A). */
export async function updateRow(
  sheetId: string,
  tab: string,
  id: string,
  fields: Record<string, string>,
  email: string,
  privateKey: string
): Promise<void> {
  if (!id?.trim()) throw new Error(`Can't update a row in ${tab} without an ID`);
  const [rowIdx, values] = await Promise.all([
    findRowIndex(sheetId, tab, id, email, privateKey),
    fieldsToRow(sheetId, tab, fields, email, privateKey),
  ]);
  if (rowIdx === -1) throw new Error(`Row with id "${id}" not found in ${tab}`);

  const token = await getAccessToken(email, privateKey);
  const lastCol = colLetter(values.length);
  const range = encodeURIComponent(`${tab}!A${rowIdx}:${lastCol}${rowIdx}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets update error: ${res.status} ${err}`);
  }
}

/** Delete a row identified by its id (column A). Uses batchUpdate to delete the row. */
export async function deleteRow(
  sheetId: string,
  tab: string,
  id: string,
  email: string,
  privateKey: string
): Promise<void> {
  if (!id?.trim()) throw new Error(`Can't delete a row in ${tab} without an ID`);
  // First get the numeric sheet (tab) ID
  const token = await getAccessToken(email, privateKey);
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) throw new Error(`Failed to get sheet metadata: ${metaRes.status}`);
  const meta = await metaRes.json();
  const sheet = meta.sheets?.find((s: { properties: { title: string } }) => s.properties.title === tab);
  if (!sheet) throw new Error(`Tab "${tab}" not found`);
  const numericSheetId = sheet.properties.sheetId;

  // Find the row
  const rowIdx = await findRowIndex(sheetId, tab, id, email, privateKey);
  if (rowIdx === -1) throw new Error(`Row with id "${id}" not found in ${tab}`);

  // Delete it
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: numericSheetId,
              dimension: 'ROWS',
              startIndex: rowIdx - 1, // 0-based
              endIndex: rowIdx,
            },
          },
        }],
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets delete error: ${res.status} ${err}`);
  }
}

/**
 * Replace all rows where column A matches `key` with new rows.
 * Used for bulk-managing Tracklists (by release) and Setlists (by event).
 */
export async function replaceRows(
  sheetId: string,
  tab: string,
  key: string,
  rows: Record<string, string>[],
  email: string,
  privateKey: string
): Promise<void> {
  const token = await getAccessToken(email, privateKey);

  // Get sheet metadata for numeric ID
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) throw new Error(`Failed to get sheet metadata: ${metaRes.status}`);
  const meta = await metaRes.json();
  const sheet = meta.sheets?.find((s: { properties: { title: string } }) => s.properties.title === tab);
  if (!sheet) throw new Error(`Tab "${tab}" not found`);
  const numericSheetId = sheet.properties.sheetId;

  // Find all matching row indices (1-based), collect in reverse order for safe deletion
  const allRows = await fetchSheet(sheetId, `${tab}!A:A`, email, privateKey);
  const indices: number[] = [];
  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][0]?.trim() === key) indices.push(i); // 0-based data index = i, 1-based sheet row = i+1
  }

  // Delete in reverse order to preserve row indices
  if (indices.length > 0) {
    const requests = indices.reverse().map(i => ({
      deleteDimension: {
        range: {
          sheetId: numericSheetId,
          dimension: 'ROWS',
          startIndex: i, // 0-based (header is row 0)
          endIndex: i + 1,
        },
      },
    }));
    const delRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      }
    );
    if (!delRes.ok) {
      const err = await delRes.text();
      throw new Error(`Sheets batch delete error: ${delRes.status} ${err}`);
    }
  }

  // Append new rows
  if (rows.length > 0) {
    const headers = await fetchHeaders(sheetId, tab, email, privateKey);
    const values = rows.map(r => headers.map(h => r[h] ?? ''));
    const range = encodeURIComponent(`${tab}!A:A`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const appRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });
    if (!appRes.ok) {
      const err = await appRes.text();
      throw new Error(`Sheets append error: ${appRes.status} ${err}`);
    }
  }
}

/** Get column headers for a tab (first row). Useful for building forms dynamically. */
export async function fetchHeaders(
  sheetId: string,
  tab: string,
  email: string,
  privateKey: string
): Promise<string[]> {
  const rows = await fetchSheet(sheetId, `${tab}!1:1`, email, privateKey);
  return rows[0]?.map(h => h.trim()) || [];
}

/**
 * Put a tab's rows in the order of `ids` (by the id in column A), by moving
 * rows rather than rewriting them. Rows not listed keep their order after
 * the listed ones. Used for photo order: the sheet's row order is the order
 * on the site, so it reads the same in the sheet.
 */
export async function reorderRows(sheetId: string, tab: string, ids: string[], email: string, privateKey: string): Promise<void> {
  const token = await getAccessToken(email, privateKey);
  const [metaRes, colA] = await Promise.all([
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(sheetId,title)`, { headers: { Authorization: `Bearer ${token}` } }),
    fetchSheetUncached(sheetId, `${tab}!A:A`, email, privateKey),
  ]);
  if (!metaRes.ok) throw new Error(`Failed to get sheet metadata: ${metaRes.status}`);
  const meta: any = await metaRes.json();
  const sheet = meta.sheets?.find((s: any) => s.properties.title === tab);
  if (!sheet) throw new Error(`Tab "${tab}" not found`);

  // Current order of data rows (sheet row 2 onwards), as ids
  const current = colA.slice(1).map(r => (r[0] || '').trim());
  const requests: unknown[] = [];
  let pos = 0;
  for (const id of ids) {
    const at = current.indexOf(id, pos);
    if (at === -1) continue; // gone since the page loaded: skip it
    if (at !== pos) {
      // Move that one row up to `pos` (+1 for the heading row)
      requests.push({ moveDimension: {
        source: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: at + 1, endIndex: at + 2 },
        destinationIndex: pos + 1,
      } });
      current.splice(pos, 0, current.splice(at, 1)[0]);
    }
    pos++;
  }
  if (!requests.length) return;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`Sheets reorder error: ${res.status} ${await res.text()}`);
}
