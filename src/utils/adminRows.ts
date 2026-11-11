/**
 * Loaded item → the full spreadsheet row the admin saves.
 *
 * The server rewrites the WHOLE row on every save and blanks any column it
 * isn't sent, so forms and quick table toggles must both build rows from
 * these helpers. Column lists match the original admin forms exactly.
 */
import type { Event, NewsPost, BlogPost, SplashPhoto, Song } from '../types';

/** Pad time like "9:30" → "09:30" (also what HTML time inputs expect). */
export function padTime(t: string | undefined): string {
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
}

export const EVENT_COLUMNS = [
  'id', 'title_en', 'title_ja', 'date', 'end_date',
  'venue', 'doors', 'start', 'end', 'adv_price',
  'door_price', 'ticket_url', 'poster_url', 'performers',
  'featured', 'body_en', 'body_ja', 'status', 'setlist_at',
  'reserve', 'reserve_cap', 'reserve_max', 'reserve_until',
  'setlist_added', 'setlist_source',
] as const;
export type EventRow = Record<typeof EVENT_COLUMNS[number], string>;

export function eventToRow(ev: Event): EventRow {
  return {
    id: ev.id,
    title_en: ev.title_en || '',
    title_ja: ev.title_ja || '',
    date: ev.date || '',
    end_date: ev.end_date || '',
    venue: ev.venue_id || '',
    doors: padTime(ev.doors),
    start: padTime(ev.start),
    end: padTime(ev.end_time),
    adv_price: ev.adv_price || '',
    door_price: ev.door_price || '',
    ticket_url: ev.ticketUrl || '',
    poster_url: ev.posterUrl || '',
    performers: ev.performers || '',
    featured: ev.featured ? 'TRUE' : '',
    body_en: ev.body_en || '',
    body_ja: ev.body_ja || '',
    status: ev.status || 'published',
    setlist_at: ev.setlist_at || '',
    reserve: ev.reserve ? 'TRUE' : '',
    reserve_cap: ev.reserve_cap || '',
    reserve_max: ev.reserve_max || '',
    reserve_until: ev.reserve_until || '',
    setlist_added: ev.setlist_added || '',
    setlist_source: ev.setlist_source || '',
  };
}

export const NEWS_COLUMNS = ['id', 'date', 'title_en', 'title_ja', 'body_en', 'body_ja', 'image_url', 'status', 'publish_at'] as const;
export type NewsRow = Record<typeof NEWS_COLUMNS[number], string>;

export function newsToRow(p: NewsPost): NewsRow {
  return {
    id: p.id, date: p.date || '', title_en: p.title_en || '', title_ja: p.title_ja || '',
    body_en: p.body_en || '', body_ja: p.body_ja || '', image_url: p.image_url || '',
    status: p.status || 'published', publish_at: p.publish_at || '',
  };
}

export const BLOG_COLUMNS = ['id', 'instagram_url', 'date', 'title_en', 'title_ja', 'status', 'publish_at'] as const;
export type BlogRow = Record<typeof BLOG_COLUMNS[number], string>;

export function blogToRow(p: BlogPost): BlogRow {
  return {
    id: p.id, instagram_url: p.instagram_url || '', date: p.date || '',
    title_en: p.title_en || '', title_ja: p.title_ja || '', status: p.status || 'published',
    publish_at: p.publish_at || '',
  };
}

export const PHOTO_COLUMNS = ['id', 'image_url', 'caption_en', 'caption_ja', 'status', 'profile_photo', 'link', 'share_image'] as const;
export type PhotoRow = Record<typeof PHOTO_COLUMNS[number], string>;

export function photoToRow(p: SplashPhoto): PhotoRow {
  return {
    id: p.id, image_url: p.image_url || '', caption_en: p.caption_en || '', caption_ja: p.caption_ja || '',
    status: p.status || 'published', profile_photo: p.profile_photo || '', link: p.link || '', share_image: p.share_image || '',
  };
}

export const SONG_COLUMNS = ['id', 'title', 'lyrics_by', 'music_by', 'lyrics_doc_id', 'original_artist', 'title_en', 'title_kana'] as const;
export type SongRow = Record<typeof SONG_COLUMNS[number], string>;

export function songToRow(x: Song): SongRow {
  return {
    id: x.id, title: x.title || '', lyrics_by: x.lyrics_by || '', music_by: x.music_by || '',
    lyrics_doc_id: x.lyrics_doc_id || '', original_artist: x.original_artist || '',
    title_en: x.title_en || '', title_kana: x.title_kana || '',
  };
}
