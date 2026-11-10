import { setlistIsPublic, isLive } from '../utils/showDates';
import { getAdminToken, adminAuthExpired } from './adminToken';
import type { Event, Album, TracklistEntry, Song, SetlistEntry, Venue, Area, Prefecture, Country, Person, NewsPost, BlogPost, SplashPhoto } from '../types';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export const cache: Record<string, CacheEntry<unknown>> = {};

async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache[key];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data as T;
  }
  const data = await fetcher();
  cache[key] = { data, fetchedAt: Date.now() };
  return data;
}

/**
 * Full data for admin pages (hidden, scheduled, not-yet-public setlists).
 * Needs the admin's sign-in; if it has run out, falls back to the public
 * view for now (not cached) and asks the admin to sign in again. Admin
 * pages refetch once they do.
 */
async function fetchAdminTab<T>(tab: string): Promise<T> {
  const key = `admin:${tab}`;
  const cached = cache[key];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data as T;
  const token = getAdminToken();
  const res = await fetch(`/api/admin/sheets/${tab}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (res.status === 401) {
    // The sign-in changed while this was in flight: ask again with the new token
    if (getAdminToken() && getAdminToken() !== token) return fetchAdminTab<T>(tab);
    adminAuthExpired();
    return fetchJson<T>(`/api/sheets/${tab}`);
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = (await res.json()) as T;
  cache[key] = { data, fetchedAt: Date.now() };
  return data;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** All events (including hidden ones) — admin pages. */
export async function getAllEvents(): Promise<Event[]> {
  try {
    return await fetchAdminTab<Event[]>('events');
  } catch (err) {
    console.error('Failed to fetch events:', err);
    return [];
  }
}

/** Events the public may see (the server already leaves hidden ones out). */
export async function getEvents(): Promise<Event[]> {
  try {
    const all = await fetchWithCache('events', () => fetchJson<Event[]>('/api/sheets/events'));
    return all.filter(e => e.status !== 'private');
  } catch (err) {
    console.error('Failed to fetch events:', err);
    return [];
  }
}

export async function getAlbums(): Promise<Album[]> {
  try {
    return await fetchWithCache('albums', () => fetchJson<Album[]>('/api/sheets/albums'));
  } catch (err) {
    console.error('Failed to fetch albums:', err);
    return [];
  }
}

export async function getTracklists(): Promise<TracklistEntry[]> {
  try {
    return await fetchWithCache('tracklists', () => fetchJson<TracklistEntry[]>('/api/sheets/tracklists'));
  } catch (err) {
    console.warn('Failed to fetch tracklists from API:', err);
    return [];
  }
}

export async function getSongs(): Promise<Song[]> {
  try {
    return await fetchWithCache('songs', () => fetchJson<Song[]>('/api/sheets/songs'));
  } catch (err) {
    console.warn('Failed to fetch songs from API:', err);
    return [];
  }
}

/** All setlists, including ones not public yet — admin pages. */
export async function getAllSetlists(): Promise<SetlistEntry[]> {
  try {
    return await fetchAdminTab<SetlistEntry[]>('setlists');
  } catch (err) {
    console.warn('Failed to fetch setlists from API:', err);
    return [];
  }
}

/**
 * Setlists the public may see: published, and only once the show is over
 * (Japan time), so a setlist can be entered ahead of time without spoilers.
 */
export async function getSetlists(): Promise<SetlistEntry[]> {
  try {
    // The server only sends public setlists (see functions/lib/visibility.ts)
    const [all, events] = await Promise.all([
      fetchWithCache('setlists', () => fetchJson<SetlistEntry[]>('/api/sheets/setlists')),
      getEvents(),
    ]);
    const open = new Set(events.filter(e => setlistIsPublic(e)).map(e => e.id));
    return all.filter(x => x.status !== 'private' && open.has(x.event));
  } catch (err) {
    console.warn('Failed to fetch setlists from API:', err);
    return [];
  }
}

export async function getVenues(): Promise<Venue[]> {
  try {
    return await fetchWithCache('venues', () => fetchJson<Venue[]>('/api/sheets/venues'));
  } catch (err) {
    console.warn('Failed to fetch venues from API:', err);
    return [];
  }
}

export async function getAreas(): Promise<Area[]> {
  try {
    return await fetchWithCache('areas', () => fetchJson<Area[]>('/api/sheets/areas'));
  } catch (err) {
    console.warn('Failed to fetch areas from API:', err);
    return [];
  }
}

export async function getPrefectures(): Promise<Prefecture[]> {
  try {
    return await fetchWithCache('prefectures', () => fetchJson<Prefecture[]>('/api/sheets/prefectures'));
  } catch (err) {
    console.warn('Failed to fetch prefectures from API:', err);
    return [];
  }
}

export async function getCountries(): Promise<Country[]> {
  try {
    return await fetchWithCache('countries', () => fetchJson<Country[]>('/api/sheets/countries'));
  } catch (err) {
    console.warn('Failed to fetch countries from API:', err);
    return [];
  }
}

/** All news posts (including drafts). */
export async function getAllNews(): Promise<NewsPost[]> {
  try {
    return await fetchAdminTab<NewsPost[]>('news');
  } catch (err) {
    console.warn('Failed to fetch news from API:', err);
    return [];
  }
}

/** Published news only. */
export async function getNews(): Promise<NewsPost[]> {
  try {
    const all = await fetchWithCache('news', () => fetchJson<NewsPost[]>('/api/sheets/news'));
    return all.filter(n => isLive(n));
  } catch (err) {
    console.warn('Failed to fetch news from API:', err);
    return [];
  }
}

/** All blog posts (including drafts). */
export async function getAllBlog(): Promise<BlogPost[]> {
  try {
    return await fetchAdminTab<BlogPost[]>('blog');
  } catch (err) {
    console.warn('Failed to fetch blog from API:', err);
    return [];
  }
}

/** Published blog posts only. */
export async function getBlog(): Promise<BlogPost[]> {
  try {
    const all = await fetchWithCache('blog', () => fetchJson<BlogPost[]>('/api/sheets/blog'));
    return all.filter(b => isLive(b));
  } catch (err) {
    console.warn('Failed to fetch blog from API:', err);
    return [];
  }
}

/** All splash photos (including drafts). */
export async function getAllPhotos(): Promise<SplashPhoto[]> {
  try {
    return await fetchAdminTab<SplashPhoto[]>('photos');
  } catch (err) {
    console.warn('Failed to fetch photos from API:', err);
    return [];
  }
}

/** Published photos, plus the About page photo even if it's hidden from the home page. */
export async function getPhotos(): Promise<SplashPhoto[]> {
  try {
    const all = await fetchWithCache('photos', () => fetchJson<SplashPhoto[]>('/api/sheets/photos'));
    return all.filter(p => isLive(p) || p.profile_photo === 'yes');
  } catch (err) {
    console.warn('Failed to fetch photos from API:', err);
    return [];
  }
}

export async function getPeople(): Promise<Person[]> {
  try {
    return await fetchWithCache('people', () => fetchJson<Person[]>('/api/sheets/people'));
  } catch (err) {
    console.warn('Failed to fetch people from API:', err);
    return [];
  }
}
