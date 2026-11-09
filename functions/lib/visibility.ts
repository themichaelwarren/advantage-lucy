/**
 * What the public may see, and when. Used by the server (so hidden or
 * scheduled things never leave it) and by the site and admin (for labels).
 *
 * All times are Japan time, as "YYYY-MM-DDTHH:mm" strings, which sort and
 * compare correctly as plain text.
 */

/** Now in Japan, "YYYY-MM-DDTHH:mm". */
export function nowInJapan(date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map(x => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Today in Japan, "YYYY-MM-DD". */
export const todayInJapan = (date = new Date()) => nowInJapan(date).slice(0, 10);

/**
 * Tidy a date-time from the sheet into "YYYY-MM-DDTHH:mm". Accepts what
 * Sheets may turn it into ("2026/11/20 18:00:00", "2026-11-20 18:00").
 * A bare date means midnight. Anything else: '' (treated as "no time set").
 */
export function normDateTime(s: string | undefined): string {
  const m = (s || '').trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return '';
  const pad = (x: string) => x.padStart(2, '0');
  return `${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(m[4] || '0')}:${m[5] || '00'}`;
}

/** Visible to the public now: not hidden, and its publish time (if any) has come. */
export function isLive(item: { status?: string; publish_at?: string }, now = nowInJapan()): boolean {
  if (item.status === 'private') return false;
  const at = normDateTime(item.publish_at);
  return !at || at <= now;
}

/** Hidden, scheduled for later, or live. */
export function liveState(item: { status?: string; publish_at?: string }, now = nowInJapan()): 'hidden' | 'scheduled' | 'live' {
  if (item.status === 'private') return 'hidden';
  const at = normDateTime(item.publish_at);
  return at && at > now ? 'scheduled' : 'live';
}

/**
 * A show's setlist goes public at its set time (setlist_at), or by default
 * the day after the show's last day, so the band can enter it beforehand
 * without spoiling it.
 */
export function setlistIsPublic(show: { date: string; end_date?: string; setlist_at?: string }, now = nowInJapan()): boolean {
  const at = normDateTime(show.setlist_at);
  if (at) return at <= now;
  return (show.end_date || show.date) < now.slice(0, 10);
}

type Row = Record<string, unknown> & { id?: string; status?: string; publish_at?: string };

/**
 * The public version of a tab: hidden and not-yet-scheduled items removed,
 * and setlists only for shows whose setlist is public. `events` (all
 * events) is needed for setlists.
 */
export function publicView(tab: string, data: unknown, events?: Row[]): unknown {
  if (!Array.isArray(data)) return data;
  const now = nowInJapan();
  const rows = data as Row[];
  switch (tab) {
    case 'events':
      return rows.filter(e => e.status !== 'private');
    case 'news':
    case 'blog':
    case 'photos':
      return rows.filter(x => isLive(x, now));
    case 'setlists': {
      const open = new Set(
        (events || [])
          .filter(e => e.status !== 'private' && setlistIsPublic(e as unknown as { date: string; end_date?: string; setlist_at?: string }, now))
          .map(e => e.id),
      );
      return rows.filter(r => r.status !== 'private' && open.has(r.event as string));
    }
    default:
      return rows;
  }
}
