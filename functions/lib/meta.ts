/**
 * Link previews (LINE, X, Facebook, Slack, iMessage…) and page titles.
 *
 * The site is a single-page app, so every address gets the same
 * index.html and the content is drawn by JavaScript. Preview bots don't
 * run JavaScript, so this works out the title, description and image for
 * an address on the server and puts them into the HTML before it's sent.
 * Used by the Pages Functions for /en/* and /ja/* and by the dev server.
 *
 * `load(tab)` returns the public view of a sheet tab (hidden things left
 * out), so a preview never shows something that isn't on the site.
 */

type Row = Record<string, any>;
export type Load = (tab: 'events' | 'albums' | 'tracklists' | 'songs' | 'news' | 'venues' | 'photos') => Promise<Row[]>;

export interface PageMeta {
  title: string;        // full title, e.g. "in Harmony | advantage Lucy"
  description: string;
  image: string;        // absolute URL
  type: 'website' | 'article' | 'music.album' | 'music.song';
  url: string;          // absolute, this page
  locale: 'en' | 'ja';
  alternate: string;    // the same page in the other language
}

const SITE = 'advantage Lucy';
const DEFAULT_IMAGE = '/img/lucy-band-404.png';
const TAGLINE = {
  en: 'advantage Lucy — indie pop from Tokyo since 1995',
  ja: 'advantage Lucy — 1995年から東京で活動するインディーポップバンド',
};
const LIST_TITLES: Record<string, { en: string; ja: string }> = {
  events: { en: 'Events', ja: 'イベント' },
  news: { en: 'News', ja: 'ニュース' },
  blog: { en: 'Blog', ja: 'ブログ' },
  releases: { en: 'Music', ja: '音楽' },
  about: { en: 'About', ja: 'プロフィール' },
  contact: { en: 'Contact', ja: 'お問い合わせ' },
  privacy: { en: 'Privacy', ja: 'プライバシー' },
};

const pick = (locale: 'en' | 'ja', en?: string, ja?: string) => ((locale === 'ja' ? ja || en : en || ja) || '').trim();
const abs = (origin: string, u?: string) => (!u ? '' : /^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith('/') ? '' : '/'}${u}`);
/** Plain text for a description: no [text](url) or **bold** marks, one line, short. */
function plain(text: string, max = 150): string {
  const t = text
    .split('\n')
    .filter(line => !/^\s*(\[[^\]]+\]\([^)]+\)\s*)+$/.test(line)) // lines that are only buttons
    .join('\n')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
function longDate(iso: string, locale: 'en' | 'ja'): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC',
  }).format(d);
}

/** Title, description and image for a site address like /ja/events/2026-11-29-tokyo. */
export async function pageMeta(pathname: string, origin: string, load: Load): Promise<PageMeta | null> {
  const m = pathname.match(/^\/(en|ja)(?:\/([^/]+)(?:\/([^/]+))?)?\/?$/);
  if (!m) return null;
  const locale = m[1] as 'en' | 'ja';
  const section = m[2] ? decodeURIComponent(m[2]) : '';
  const id = m[3] ? decodeURIComponent(m[3]) : '';
  if (section === 'admin') return null;

  const other = locale === 'en' ? 'ja' : 'en';
  const base = {
    url: `${origin}${pathname}`,
    locale,
    alternate: `${origin}/${other}${pathname.slice(3)}`,
  };
  // The picture for pages without one of their own: the photo marked
  // "share image" in admin (Photos), else the band drawing
  const shared = await load('photos')
    .then(ps => ps.find(p => p.share_image === 'yes' && p.image_url)?.image_url as string | undefined)
    .catch(() => undefined);
  const make = (title: string | null, description: string, image?: string, type: PageMeta['type'] = 'website'): PageMeta => ({
    ...base,
    title: title ? `${title} | ${SITE}` : SITE,
    description: description || TAGLINE[locale],
    image: abs(origin, image) || abs(origin, shared) || abs(origin, DEFAULT_IMAGE),
    type,
  });

  // Home and the list pages: fixed titles
  if (!section) return make(null, TAGLINE[locale]);
  if (!id) {
    const t = LIST_TITLES[section];
    return t ? make(t[locale], TAGLINE[locale]) : null;
  }

  try {
    if (section === 'events') {
      const e = (await load('events')).find(x => x.id === id);
      if (!e) return null;
      const venue = pick(locale, e.venue_en, e.venue_ja);
      const city = pick(locale, e.city_en, e.city_ja);
      const title = pick(locale, e.title_en, e.title_ja) || venue;
      const when = longDate(e.date, locale);
      const times = [
        e.doors && (locale === 'ja' ? `開場 ${e.doors}` : `Doors ${e.doors}`),
        e.start && (locale === 'ja' ? `開演 ${e.start}` : `Start ${e.start}`),
      ].filter(Boolean).join(' / ');
      const place = venue ? (city ? (locale === 'ja' ? `${venue}（${city}）` : `${venue}, ${city}`) : venue) : '';
      const lineup = e.performers ? plain(`${locale === 'ja' ? '出演' : 'With'} ${e.performers}`, 90) : '';
      const desc = [when, place, times, lineup].filter(Boolean).join(locale === 'ja' ? '　' : ' · ');
      return make(title, desc, e.posterUrl, 'article');
    }

    if (section === 'releases') {
      const a = (await load('albums')).find(x => x.id === id);
      if (!a) return null;
      const tracks = (await load('tracklists')).filter(t => t.release === a.title).length;
      const kind = String(a.type || '').toUpperCase();
      const facts = [a.year || (a.date || '').slice(0, 4), kind, tracks ? (locale === 'ja' ? `全${tracks}曲` : `${tracks} tracks`) : '', a.label]
        .filter(Boolean).join(' · ');
      const about = plain(pick(locale, a.description_en, a.description_ja), 100);
      // English pages: the English title first, the original after it (as for songs)
      const name = locale === 'en' && a.title_en && a.title_en !== a.title ? `${a.title_en} (${a.title})` : a.title;
      return make(name, [facts, about].filter(Boolean).join(locale === 'ja' ? '。' : '. '), a.coverUrl, 'music.album');
    }

    if (section === 'songs') {
      const s = (await load('songs')).find(x => x.id === id);
      if (!s) return null;
      // Artwork and wording from the first release it's on
      const onRelease = (await load('tracklists')).find(t => t.title === s.title);
      const album = onRelease ? (await load('albums')).find(x => x.title === onRelease.release) : undefined;
      const desc = s.original_artist
        ? (locale === 'ja' ? `${s.original_artist}のカバー` : `${s.original_artist} cover`)
        : album
          ? (locale === 'ja' ? `「${album.title}」収録` : `From “${album.title_en || album.title}”`)
          : TAGLINE[locale];
      // English pages: the English title (mostly romaji) first, the original after it
      const title = locale === 'en' && s.title_en && s.title_en !== s.title ? `${s.title_en} (${s.title})` : s.title;
      return make(title, desc, album?.coverUrl, 'music.song');
    }

    if (section === 'news') {
      const n = (await load('news')).find(x => x.id === id);
      if (!n) return null;
      const title = pick(locale, n.title_en, n.title_ja);
      return make(title, plain(pick(locale, n.body_en, n.body_ja)) || longDate(n.date, locale), n.image_url, 'article');
    }

    if (section === 'venues') {
      const v = (await load('venues')).find(x => x.id === id);
      if (!v) return null;
      const name = pick(locale, v.name_en, v.name_ja);
      const shows = (await load('events')).filter(e => e.venue_id === v.id);
      const city = shows[0] ? pick(locale, shows[0].city_en, shows[0].city_ja) : '';
      const desc = locale === 'ja'
        ? [city, `advantage Lucyのライブ ${shows.length}回`].filter(Boolean).join('・')
        : [city, `${shows.length} advantage Lucy show${shows.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
      return make(name, desc);
    }
  } catch {
    // Sheet unavailable: fall back to the plain site preview rather than fail the page
    return make(null, TAGLINE[locale]);
  }
  return null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Put the tags into index.html: replaces the title and description, adds the preview tags. */
export function injectMeta(html: string, meta: PageMeta): string {
  const tags = [
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(meta.url)}" />`,
    `<meta property="og:image" content="${esc(meta.image)}" />`,
    `<meta property="og:locale" content="${meta.locale === 'ja' ? 'ja_JP' : 'en_US'}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(meta.image)}" />`,
    `<link rel="canonical" href="${esc(meta.url)}" />`,
    `<link rel="alternate" hreflang="${meta.locale}" href="${esc(meta.url)}" />`,
    `<link rel="alternate" hreflang="${meta.locale === 'en' ? 'ja' : 'en'}" href="${esc(meta.alternate)}" />`,
  ].join('\n  ');
  return html
    // index.html carries site-wide defaults (for the bare domain); this page's replace them
    .replace(/\s*<meta (?:property="og:[^"]*"|name="twitter:[^"]*") content="[^"]*"\s*\/?>/g, '')
    .replace(/<html lang="[^"]*"/, `<html lang="${meta.locale}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(meta.description)}" />`)
    .replace('</head>', `  ${tags}\n</head>`);
}
