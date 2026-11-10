/**
 * Streaming services a release can link to, one sheet column each (Albums
 * tab, added on first save). `listen_url` stays as the "all services" page
 * (song.link and the like) for anything not listed here.
 */
export const LISTEN_SERVICES = [
  { key: 'apple', column: 'apple_music_url', name: 'Apple Music', hosts: /(^|\.)(music|itunes|geo\.music)\.apple\.com$/ },
  { key: 'spotify', column: 'spotify_url', name: 'Spotify', hosts: /(^|\.)(open\.spotify\.com|spotify\.link)$/ },
  { key: 'youtube', column: 'youtube_music_url', name: 'YouTube Music', hosts: /(^|\.)music\.youtube\.com$/ },
  { key: 'amazon', column: 'amazon_music_url', name: 'Amazon Music', hosts: /(^|\.)music\.amazon\.[a-z.]+$/ },
  { key: 'line', column: 'line_music_url', name: 'LINE MUSIC', hosts: /(^|\.)music\.line\.me$/ },
] as const;

export type ListenService = typeof LISTEN_SERVICES[number]['key'];
export const LISTEN_COLUMNS = LISTEN_SERVICES.map(x => x.column);

/** Which service a link is on, if it's one of ours. */
export function serviceOf(url: string): ListenService | null {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return LISTEN_SERVICES.find(x => x.hosts.test(host))?.key ?? null;
  } catch { return null; }
}

/** The per-service links in a sheet row. */
export function listenFromRow(row: Record<string, string | undefined>): Partial<Record<ListenService, string>> | undefined {
  const out: Partial<Record<ListenService, string>> = {};
  for (const x of LISTEN_SERVICES) { const v = row[x.column]?.trim(); if (v) out[x.key] = v; }
  return Object.keys(out).length ? out : undefined;
}
