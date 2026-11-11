/**
 * Google Sheets helpers for Cloudflare Workers.
 * Mirrors server/sheets.ts but uses shared auth and no Node.js deps.
 */
import { normDateTime } from './visibility';
import { getAccessToken } from './auth';
import { LISTEN_COLUMNS, listenFromRow } from './listen';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export interface Env {
  VITE_GOOGLE_SHEET_ID: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_DRIVE_FOLDER_ID?: string;
}

export function getCredentials(env: Env) {
  const sheetId = env.VITE_GOOGLE_SHEET_ID;
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!sheetId || !email || !privateKey) {
    throw new Error('Missing Google Sheets env vars');
  }
  return { sheetId, email, privateKey };
}

async function getToken(email: string, privateKey: string) {
  return getAccessToken(email, privateKey, SCOPE);
}

export async function fetchSheet(
  sheetId: string, range: string, email: string, privateKey: string
): Promise<string[][]> {
  const token = await getToken(email, privateKey);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API error: ${res.status} ${err}`);
  }
  const data: any = await res.json();
  return data.values || [];
}

export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((key, i) => { obj[key] = row[i]?.trim() || ''; });
    return obj;
  });
}

// ---------- Reference tables ----------

export async function fetchCountries(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Countries!A:C', email, key);
  return rowsToObjects(rows).map(r => ({ id: r.id, name_en: r.name_en, name_ja: r.name_ja }));
}

export async function fetchPrefectures(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Prefectures!A:D', email, key);
  return rowsToObjects(rows).map(r => ({ id: r.id, name_en: r.name_en, name_ja: r.name_ja, country: r.country }));
}

export async function fetchAreas(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Areas!A:D', email, key);
  return rowsToObjects(rows).map(r => ({ id: r.id, name_en: r.name_en, name_ja: r.name_ja, prefecture: r.prefecture }));
}

export async function fetchVenues(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Venues!A:E', email, key);
  return rowsToObjects(rows).map(r => ({ id: r.id, name_en: r.name_en, name_ja: r.name_ja, area: r.area, url: r.url || undefined }));
}

// ---------- Events (with venue join) ----------

export async function fetchEvents(sheetId: string, email: string, key: string) {
  const [eventRows, venues, areas, prefectures, countries] = await Promise.all([
    fetchSheet(sheetId, 'Events', email, key),
    fetchVenues(sheetId, email, key),
    fetchAreas(sheetId, email, key),
    fetchPrefectures(sheetId, email, key),
    fetchCountries(sheetId, email, key),
  ]);

  const venueMap = new Map(venues.map(v => [v.id, v]));
  const areaMap = new Map(areas.map(a => [a.id, a]));
  const prefMap = new Map(prefectures.map(p => [p.id, p]));
  const countryMap = new Map(countries.map(c => [c.id, c]));

  return rowsToObjects(eventRows)
    .filter(row => row.date)
    .map(row => {
      const venue = venueMap.get(row.venue);
      const area = venue ? areaMap.get(venue.area) : undefined;
      const pref = area ? prefMap.get(area.prefecture) : undefined;
      const country = pref ? countryMap.get(pref.country) : undefined;
      return {
        id: row.id, title_en: row.title_en, title_ja: row.title_ja,
        date: row.date, end_date: row.end_date || undefined,
        doors: row.doors || undefined, start: row.start || undefined, end_time: row.end || undefined,
        adv_price: row.adv_price || undefined, door_price: row.door_price || undefined,
        venue_id: row.venue || undefined,
        venue_en: venue?.name_en || row.venue || '', venue_ja: venue?.name_ja || row.venue || '',
        venue_url: venue?.url || undefined,
        city_en: area?.name_en || '', city_ja: area?.name_ja || '',
        prefecture_en: pref?.name_en || undefined, prefecture_ja: pref?.name_ja || undefined,
        country_en: country?.name_en || undefined, country_ja: country?.name_ja || undefined,
        ticketUrl: row.ticket_url || undefined, performers: row.performers || undefined,
        posterUrl: row.poster_url || undefined,
        featured: row.featured === 'TRUE' || row.featured === 'true',
        status: row.status || 'published',
        body_en: row.body_en || undefined, body_ja: row.body_ja || undefined,
        // When the setlist goes public (Japan time); blank = the day after the show
        setlist_at: normDateTime(row.setlist_at) || undefined,
        setlist_added: row.setlist_added || undefined,
        setlist_source: row.setlist_source || undefined,
        // Ticket reservations through the site (functions/lib/reservations.ts)
        reserve: row.reserve === 'TRUE' || row.reserve === 'true',
        reserve_cap: row.reserve_cap || undefined,
        reserve_max: row.reserve_max || undefined,
        reserve_until: normDateTime(row.reserve_until) || undefined,
      };
    });
}

export async function fetchAlbums(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Albums!A:Z', email, key);
  return rowsToObjects(rows).map(r => ({
    id: r.id, title: r.title, title_en: r.title_en || undefined, title_kana: r.title_kana || undefined, date: r.date || undefined, year: r.year, type: r.type,
    number: r.number || undefined, format: r.format || undefined, label: r.label || undefined,
    coverUrl: r.artwork_url || undefined, listenUrl: r.listen_url || undefined, listen: listenFromRow(r),
    // 'private' = a draft: not on the site yet (e.g. before it's announced)
    status: (r.status || '').trim() || undefined,
    description_en: r.description_en || undefined, description_ja: r.description_ja || undefined,
  }));
}

export async function fetchTracklists(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Tracklists!A:C', email, key);
  return rowsToObjects(rows).map(r => ({ release: r.release, track: parseInt(r.track, 10) || 0, title: r.title }));
}

export async function fetchSongs(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Songs', email, key);
  return rowsToObjects(rows).map(r => ({
    id: r.id, title: r.title, music_by: r.music_by || undefined,
    lyrics_by: r.lyrics_by || undefined, lyrics_doc_id: r.lyrics_doc_id || undefined,
    // Covers: who did it first ("The Smiths"); blank for the band's own songs
    original_artist: r.original_artist || undefined,
    // The title in English (mostly romaji, as on streaming services) and its 読み for 50音 order
    title_en: (r.title_en || '').trim() || undefined,
    title_kana: (r.title_kana || '').trim() || undefined,
    // 'private' = a draft: no page on the site yet (its title still shows in setlists)
    status: (r.status || '').trim() || undefined,
    // 'private' = the page is live but the lyrics aren't shown yet (e.g. until the release)
    lyrics_status: (r.lyrics_status || '').trim() || undefined,
  }));
}

export async function fetchPeople(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'People!A:E', email, key);
  return rowsToObjects(rows).map(r => ({
    id: r.id, name_family_en: r.name_family_en || '', name_given_en: r.name_given_en || '',
    name_family_ja: r.name_family_ja || '', name_given_ja: r.name_given_ja || '',
  }));
}

export async function fetchSetlists(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Setlists!A:F', email, key);
  return rowsToObjects(rows).map(r => ({
    event: r.event, song: r.song, set: r.set || '1',
    order: parseInt(r.order, 10) || 0, notes: r.notes || undefined,
    status: r.status || 'published',
  }));
}

export async function fetchNews(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'News', email, key);
  return rowsToObjects(rows).map(r => ({
    id: r.id, date: r.date, title_en: r.title_en || '', title_ja: r.title_ja || '',
    body_en: r.body_en || undefined, body_ja: r.body_ja || undefined,
    image_url: r.image_url || undefined, status: r.status || 'published',
    publish_at: normDateTime(r.publish_at) || undefined,   // scheduled: goes live then (Japan time)
  }));
}

export async function fetchBlog(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Blog', email, key);
  return rowsToObjects(rows).map(r => ({
    id: r.id, instagram_url: r.instagram_url || '', date: r.date,
    title_en: r.title_en || '', title_ja: r.title_ja || '',
    status: r.status || 'published',
    publish_at: normDateTime(r.publish_at) || undefined,
  }));
}

export async function fetchPhotos(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Photos', email, key);
  return rowsToObjects(rows).map(r => ({
    id: r.id, image_url: r.image_url || '',
    caption_en: r.caption_en || undefined, caption_ja: r.caption_ja || undefined,
    status: r.status || 'published',
    profile_photo: r.profile_photo || undefined,
    share_image: r.share_image || undefined,
    link: (r.link || '').trim() || undefined,
  }));
}

// ========== WRITE OPERATIONS ==========

function colLetter(n: number): string {
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

export async function fetchHeaders(sheetId: string, tab: string, email: string, key: string): Promise<string[]> {
  const rows = await fetchSheet(sheetId, `${tab}!1:1`, email, key);
  return rows[0]?.map(h => h.trim()) || [];
}

/**
 * Columns added after the sheet was first set up. If a save fills one in
 * and the tab doesn't have that heading yet, the heading is added (next
 * free column) instead of the value being silently dropped. Only these
 * known names, never arbitrary fields.
 */
const OPTIONAL_COLUMNS: Record<string, string[]> = {
  Songs: ['original_artist', 'title_en', 'title_kana', 'status', 'lyrics_status'],
  Events: ['setlist_at', 'reserve', 'reserve_cap', 'reserve_max', 'reserve_until', 'setlist_added', 'setlist_source'],
  News: ['publish_at'],
  Blog: ['publish_at'],
  Photos: ['link', 'share_image'],
  Albums: ['title_en', 'title_kana', ...LISTEN_COLUMNS, 'status'],
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

async function ensureColumns(sheetId: string, tab: string, fields: Record<string, string>, email: string, key: string): Promise<string[]> {
  const headers = await fetchHeaders(sheetId, tab, email, key);
  const missing = (OPTIONAL_COLUMNS[tab] || []).filter(c => fields[c]?.trim() && !headers.includes(c));
  if (!missing.length) return headers;
  const token = await getToken(email, key);
  const from = headers.length + 1;
  await widenTab(sheetId, tab, from + missing.length - 1, token);
  const range = encodeURIComponent(`${tab}!${colLetter(from)}1:${colLetter(from + missing.length - 1)}1`);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [missing] }),
  });
  if (!res.ok) throw new Error(`Couldn't add column ${missing.join(', ')} to ${tab}: ${res.status} ${await res.text()}`);
  return [...headers, ...missing];
}

async function fieldsToRow(sheetId: string, tab: string, fields: Record<string, string>, email: string, key: string): Promise<string[]> {
  const headers = await ensureColumns(sheetId, tab, fields, email, key);
  return headers.map(h => fields[h] ?? '');
}

export async function appendRow(sheetId: string, tab: string, fields: Record<string, string>, email: string, key: string): Promise<string> {
  // Tabs with an id column need one on every row: a blank ID can't be
  // linked to, opened in the admin or saved again
  const headers = await fetchHeaders(sheetId, tab, email, key);
  if (headers.includes('id') && !fields.id?.trim()) throw new Error(`New ${tab} rows need an ID`);
  const values = await fieldsToRow(sheetId, tab, fields, email, key);
  const token = await getToken(email, key);
  const range = encodeURIComponent(`${tab}!A:A`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Sheets append error: ${res.status} ${err}`); }
  const data: any = await res.json();
  return data.updates?.updatedRange || '';
}

async function findRowIndex(sheetId: string, tab: string, id: string, email: string, key: string): Promise<number> {
  const rows = await fetchSheet(sheetId, `${tab}!A:A`, email, key);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]?.trim() === id) return i + 1;
  }
  return -1;
}

export async function updateRow(sheetId: string, tab: string, id: string, fields: Record<string, string>, email: string, key: string): Promise<void> {
  if (!id?.trim()) throw new Error(`Can't update a row in ${tab} without an ID`);
  const [rowIdx, values] = await Promise.all([
    findRowIndex(sheetId, tab, id, email, key),
    fieldsToRow(sheetId, tab, fields, email, key),
  ]);
  if (rowIdx === -1) throw new Error(`Row with id "${id}" not found in ${tab}`);
  const token = await getToken(email, key);
  const lastCol = colLetter(values.length);
  const range = encodeURIComponent(`${tab}!A${rowIdx}:${lastCol}${rowIdx}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Sheets update error: ${res.status} ${err}`); }
}

export async function deleteRow(sheetId: string, tab: string, id: string, email: string, key: string): Promise<void> {
  if (!id?.trim()) throw new Error(`Can't delete a row in ${tab} without an ID`);
  const token = await getToken(email, key);
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) throw new Error(`Failed to get sheet metadata: ${metaRes.status}`);
  const meta: any = await metaRes.json();
  const sheet = meta.sheets?.find((s: any) => s.properties.title === tab);
  if (!sheet) throw new Error(`Tab "${tab}" not found`);

  const rowIdx = await findRowIndex(sheetId, tab, id, email, key);
  if (rowIdx === -1) throw new Error(`Row with id "${id}" not found in ${tab}`);

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIdx - 1, endIndex: rowIdx } } }],
    }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Sheets delete error: ${res.status} ${err}`); }
}

export async function replaceRows(
  sheetId: string, tab: string, key: string, rows: Record<string, string>[], email: string, privateKey: string
): Promise<void> {
  const token = await getToken(email, privateKey);

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) throw new Error(`Failed to get sheet metadata: ${metaRes.status}`);
  const meta: any = await metaRes.json();
  const sheet = meta.sheets?.find((s: any) => s.properties.title === tab);
  if (!sheet) throw new Error(`Tab "${tab}" not found`);
  const numericSheetId = sheet.properties.sheetId;

  const allRows = await fetchSheet(sheetId, `${tab}!A:A`, email, privateKey);
  const indices: number[] = [];
  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][0]?.trim() === key) indices.push(i);
  }

  if (indices.length > 0) {
    const requests = indices.reverse().map(i => ({
      deleteDimension: { range: { sheetId: numericSheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } },
    }));
    const delRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });
    if (!delRes.ok) { const err = await delRes.text(); throw new Error(`Sheets batch delete error: ${delRes.status} ${err}`); }
  }

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
    if (!appRes.ok) { const err = await appRes.text(); throw new Error(`Sheets append error: ${appRes.status} ${err}`); }
  }
}

/**
 * Put a tab's rows in the order of `ids` (by the id in column A), by moving
 * rows rather than rewriting them. Rows not listed keep their order after
 * the listed ones. Used for photo order: the sheet's row order is the order
 * on the site, so it reads the same in the sheet.
 */
export async function reorderRows(sheetId: string, tab: string, ids: string[], email: string, privateKey: string): Promise<void> {
  const token = await getToken(email, privateKey);
  const [metaRes, colA] = await Promise.all([
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(sheetId,title)`, { headers: { Authorization: `Bearer ${token}` } }),
    fetchSheet(sheetId, `${tab}!A:A`, email, privateKey),
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
