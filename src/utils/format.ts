import type { Locale } from '../i18n/translations';
import type { Event } from '../types';

const JA_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * Format a date string (YYYY-MM-DD) for display.
 * EN: "Apr 6, 2024" (short) or "Saturday, April 6, 2024" (long)
 * JA: "2024-04-06 (土)" — always YYYY-MM-DD with short weekday
 */
export function formatDate(
  date: string,
  locale: Locale,
  style: 'short' | 'long' = 'short'
): string {
  const d = new Date(date + 'T00:00:00');

  if (locale === 'ja') {
    const day = JA_DAYS[d.getDay()];
    return `${date} (${day})`;
  }

  if (style === 'long') {
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    });
  }

  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/**
 * Get event display title, falling back to "date @ venue" if no title exists.
 */
export function getEventTitle(event: Event, locale: Locale): string {
  const title = locale === 'ja' ? event.title_ja : event.title_en;
  if (title) return title;

  const venue = locale === 'ja' ? event.venue_ja : event.venue_en;
  return `${event.date} ${venue}`;
}
