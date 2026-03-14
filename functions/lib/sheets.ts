/**
 * Google Sheets helpers for Cloudflare Workers.
 * Mirrors server/sheets.ts but uses shared auth and no Node.js deps.
 */
import { getAccessToken } from './auth';

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
    fetchSheet(sheetId, 'Events!A:R', email, key),
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
      };
    });
}

export async function fetchAlbums(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Albums!A:L', email, key);
  return rowsToObjects(rows).map(r => ({
    id: r.id, title: r.title, date: r.date || undefined, year: r.year, type: r.type,
    number: r.number || undefined, format: r.format || undefined, label: r.label || undefined,
    coverUrl: r.artwork_url || undefined, listenUrl: r.listen_url || undefined,
    description_en: r.description_en || undefined, description_ja: r.description_ja || undefined,
  }));
}

export async function fetchTracklists(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Tracklists!A:C', email, key);
  return rowsToObjects(rows).map(r => ({ release: r.release, track: parseInt(r.track, 10) || 0, title: r.title }));
}

export async function fetchSongs(sheetId: string, email: string, key: string) {
  const rows = await fetchSheet(sheetId, 'Songs!A:E', email, key);
  return rowsToObjects(rows).map(r => ({
    id: r.id, title: r.title, music_by: r.music_by || undefined,
    lyrics_by: r.lyrics_by || undefined, lyrics_doc_id: r.lyrics_doc_id || undefined,
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

async function fieldsToRow(sheetId: string, tab: string, fields: Record<string, string>, email: string, key: string): Promise<string[]> {
  const headers = await fetchHeaders(sheetId, tab, email, key);
  return headers.map(h => fields[h] ?? '');
}

export async function appendRow(sheetId: string, tab: string, fields: Record<string, string>, email: string, key: string): Promise<string> {
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
