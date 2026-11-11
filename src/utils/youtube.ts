/** YouTube links and times (admin video tools). */

/** The video id from any usual YouTube link (watch, youtu.be, shorts, live, embed), else null. */
export function youTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/);
      return m ? m[1] : null;
    }
  } catch { /* not a link */ }
  return null;
}

/** A t= / start= in the link, in seconds (e.g. ?t=1h2m3s or ?t=3723). */
export function youTubeStart(url: string): number | null {
  try {
    const u = new URL(url.trim());
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    return t ? parseTime(t) : null;
  } catch { return null; }
}

export const youTubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const youTubeWatch = (id: string, start?: number | null) =>
  `https://www.youtube.com/watch?v=${id}${start ? `&t=${Math.floor(start)}s` : ''}`;

/** 83 → "1:23", 3723 → "1:02:03" */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** "1:23", "1:02:03", "83", "1h2m3s", "2m" → seconds; null if it isn't a time. */
/**
 * A time typed in a box, on any keyboard. The iPhone number pad has no ":",
 * so digits read like a clock: 505 → 5:05, 1234 → 12:34, 10305 → 1:03:05;
 * one or two digits are seconds (45 → 0:45). "5.05" and "5:05" work too.
 * (Not for YouTube's ?t=505, which is seconds: that's parseTime.)
 */
export function parseTypedTime(text: string): number | null {
  const t = text.trim().replace(/[：．。]/g, m => (m === '：' ? ':' : '.'));
  if (!t) return null;
  if (/^\d{1,6}$/.test(t)) {
    const d = t.padStart(6, '0');
    const [h, m, s] = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].map(Number);
    return s < 60 && (h === 0 ? true : m < 60) ? h * 3600 + m * 60 + s : null;
  }
  const parts = t.split(/[:.]/);
  if (parts.length >= 2 && parts.length <= 3 && parts.every(p => /^\d{1,2}$/.test(p) || (p === parts[0] && /^\d{1,3}$/.test(p)))) {
    const n = parts.map(Number);
    if (n.slice(1).some(x => x >= 60)) return null;
    return n.reduce((acc, x) => acc * 60 + x, 0);
  }
  return parseTime(t);
}

export function parseTime(text: string): number | null {
  const t = text.trim().replace(/[：]/g, ':');
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.floor(Number(t));
  if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(t)) return t.split(':').reduce((acc, n) => acc * 60 + Number(n), 0);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return null;
}
