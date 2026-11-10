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
export function parseTime(text: string): number | null {
  const t = text.trim().replace(/[：]/g, ':');
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.floor(Number(t));
  if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(t)) return t.split(':').reduce((acc, n) => acc * 60 + Number(n), 0);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return null;
}
