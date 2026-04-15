import type { Locale } from '../i18n/translations';
import type { Event } from '../types';

const JA_DAYS = ['日', '月', '火', '水', '木', '金', '土'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** YYYY-MM-DD with short weekday, e.g. "2026-03-14 (Sat)" / "2026-03-14 （土）" */
export function formatDateWithDay(date: string, locale: Locale): string {
  const d = new Date(date + 'T00:00:00');
  if (locale === 'ja') return `${date} （${JA_DAYS[d.getDay()]}）`;
  return `${date} (${EN_DAYS[d.getDay()]})`;
}

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

/** Country → currency symbol map */
const CURRENCY: Record<string, string> = {
  Japan: '¥',
  'United States': '$',
  'United Kingdom': '£',
  Canada: 'CA$',
  Australia: 'A$',
  China: '¥',
  'South Korea': '₩',
  Taiwan: 'NT$',
};

/**
 * Format a price string for display.
 * "0" → FREE / 入場無料, otherwise add currency symbol + comma separators.
 */
export function formatPrice(
  price: string,
  locale: Locale,
  country?: string,
): string {
  const n = Number(price);
  if (isNaN(n)) return price; // non-numeric, return as-is
  if (n === 0) return locale === 'ja' ? '入場無料' : 'FREE';

  const symbol = (country && CURRENCY[country]) || '¥';
  return `${symbol}${n.toLocaleString()}`;
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
