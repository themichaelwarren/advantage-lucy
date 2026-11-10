import type { Event, SplashPhoto } from '../types';
import type { Locale } from '../i18n/translations';
import { todayInJapan, isLive } from './showDates';

/**
 * Home-page photo links. A photo's `link` is one of:
 *  - '/events/<id>': a show (the admin's show picker writes this)
 *  - another page on this site, like '/news/…' (with or without /en or /ja)
 *  - a full https:// address (opens in a new tab)
 */

/** The show id when a link points at a show, else undefined. */
export function showLinkId(link?: string): string | undefined {
  const m = (link || '').trim().match(/^(?:\/(?:en|ja))?\/events\/([^/?#]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

export interface Slide {
  id: string;
  image_url: string;
  /** Caption text, or for a show with no caption, its date and venue */
  label?: string;
  href?: string;
  external?: boolean;
  /** Show the whole image, never cropped (flyers) */
  fit?: boolean;
}

function siteHref(link: string, locale: Locale): { href?: string; external?: boolean } {
  const l = link.trim();
  if (!l) return {};
  if (/^https?:\/\//i.test(l)) return { href: l, external: true };
  if (!l.startsWith('/')) return { href: `https://${l}`, external: true };
  // Our own page: put it in the reader's language
  return { href: `/${locale}${l.replace(/^\/(en|ja)(?=\/|$)/, '') || '/'}` };
}

/** M/D (Japanese) or Nov 29 (English) */
function shortDate(iso: string, locale: Locale): string {
  const [, m, d] = iso.split('-').map(Number);
  if (locale === 'ja') return `${m}/${d}`;
  return new Date(Date.UTC(2000, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Photos as home-page slides, in sheet order. A photo linked to a show
 * drops out once the show is over (or if the show is hidden or gone), so a
 * flyer never advertises a past date.
 */
export function photoSlides(photos: SplashPhoto[], events: Event[], locale: Locale, today = todayInJapan()): Slide[] {
  const slides: Slide[] = [];
  for (const p of photos) {
    if (!p.image_url || !isLive(p)) continue; // hidden: may still be the About page photo
    const caption = (locale === 'ja' ? p.caption_ja || p.caption_en : p.caption_en || p.caption_ja) || undefined;
    const showId = showLinkId(p.link);
    if (showId) {
      const show = events.find(e => e.id === showId);
      if (!show || (show.end_date || show.date) < today) continue;
      // Short by default: the date and venue (the flyer itself has the title)
      const venue = locale === 'ja' ? show.venue_ja || show.venue_en : show.venue_en || show.venue_ja;
      const title = locale === 'ja' ? show.title_ja || show.title_en : show.title_en || show.title_ja;
      slides.push({
        id: p.id, image_url: p.image_url,
        label: caption || [shortDate(show.date, locale), venue || title].filter(Boolean).join(' '),
        href: `/${locale}/events/${show.id}`,
        fit: true,
      });
      continue;
    }
    slides.push({ id: p.id, image_url: p.image_url, label: caption, ...(p.link ? siteHref(p.link, locale) : {}) });
  }
  return slides;
}
