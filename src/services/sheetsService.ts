import type { Event, Album, TracklistEntry, Song, SetlistEntry, Venue, Area } from '../types';
import { mockEvents, mockAlbums } from './mockData';

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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** All events (including drafts) — used by admin pages. */
export async function getAllEvents(): Promise<Event[]> {
  try {
    return await fetchWithCache('events', () => fetchJson<Event[]>('/api/sheets/events'));
  } catch (err) {
    console.warn('Failed to fetch events from API, using mock data:', err);
    return mockEvents;
  }
}

/** Published events only — used by public-facing pages. */
export async function getEvents(): Promise<Event[]> {
  const all = await getAllEvents();
  return all.filter(e => e.status !== 'private');
}

export async function getAlbums(): Promise<Album[]> {
  try {
    return await fetchWithCache('albums', () => fetchJson<Album[]>('/api/sheets/albums'));
  } catch (err) {
    console.warn('Failed to fetch albums from API, using mock data:', err);
    return mockAlbums;
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

/** All setlists (including drafts). */
export async function getAllSetlists(): Promise<SetlistEntry[]> {
  try {
    return await fetchWithCache('setlists', () => fetchJson<SetlistEntry[]>('/api/sheets/setlists'));
  } catch (err) {
    console.warn('Failed to fetch setlists from API:', err);
    return [];
  }
}

/** Published setlists only — used by public-facing pages. */
export async function getSetlists(): Promise<SetlistEntry[]> {
  const all = await getAllSetlists();
  return all.filter(s => s.status !== 'private');
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
