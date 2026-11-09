import { useState, useEffect, useSyncExternalStore } from 'react';
import { subscribeAdminToken, getAdminTokenVersion } from '../services/adminToken';

/** Changes whenever the admin signs in (again), so admin data reloads with full access. */
const useAdminTokenVersion = () => useSyncExternalStore(subscribeAdminToken, getAdminTokenVersion);
import type { Event, Album, TracklistEntry, Song, SetlistEntry, Venue, Area, Prefecture, Country, Person, NewsPost, BlogPost, SplashPhoto } from '../types';
import { getEvents, getAllEvents, getAlbums, getTracklists, getSongs, getSetlists, getAllSetlists, getNews, getAllNews, getBlog, getAllBlog, getPhotos, getAllPhotos, getVenues, getAreas, getPrefectures, getCountries, getPeople } from '../services/sheetsService';

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  return { events, loading };
}

/** All events including drafts — for admin use. */
export function useAllEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const signedIn = useAdminTokenVersion();

  useEffect(() => {
    getAllEvents()
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [signedIn]);

  return { events, loading };
}

export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAlbums()
      .then(setAlbums)
      .finally(() => setLoading(false));
  }, []);

  return { albums, loading };
}

export function useTracklists() {
  const [tracklists, setTracklists] = useState<TracklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getTracklists()
      .then(setTracklists)
      .finally(() => setLoading(false));
  }, [tick]);

  return { tracklists, loading, refresh: () => setTick(t => t + 1) };
}

export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getSongs()
      .then(setSongs)
      .finally(() => setLoading(false));
  }, [tick]);

  return { songs, loading, refresh: () => setTick(t => t + 1) };
}

/** Every setlist row, including hidden and not-yet-played ones. Admin only. */
export function useAllSetlists() {
  const [setlists, setSetlists] = useState<SetlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const signedIn = useAdminTokenVersion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getAllSetlists()
      .then(setSetlists)
      .finally(() => setLoading(false));
  }, [tick, signedIn]);

  return { setlists, loading, refresh: () => setTick(t => t + 1) };
}

/** Setlists the public may see (published, show already played). */
export function useSetlists() {
  const [setlists, setSetlists] = useState<SetlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSetlists()
      .then(setSetlists)
      .finally(() => setLoading(false));
  }, []);

  return { setlists, loading };
}

export function useVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getVenues()
      .then(setVenues)
      .finally(() => setLoading(false));
  }, [tick]);

  return { venues, loading, refresh: () => setTick(t => t + 1) };
}

export function useNews() {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNews()
      .then(setNews)
      .finally(() => setLoading(false));
  }, []);

  return { news, loading };
}

export function useAllNews() {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const signedIn = useAdminTokenVersion();

  useEffect(() => {
    getAllNews()
      .then(setNews)
      .finally(() => setLoading(false));
  }, [signedIn]);

  return { news, loading };
}

export function useBlog() {
  const [blog, setBlog] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlog()
      .then(setBlog)
      .finally(() => setLoading(false));
  }, []);

  return { blog, loading };
}

export function useAllBlog() {
  const [blog, setBlog] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const signedIn = useAdminTokenVersion();

  useEffect(() => {
    getAllBlog()
      .then(setBlog)
      .finally(() => setLoading(false));
  }, [signedIn]);

  return { blog, loading };
}

export function usePhotos() {
  const [photos, setPhotos] = useState<SplashPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPhotos()
      .then(setPhotos)
      .finally(() => setLoading(false));
  }, []);

  return { photos, loading };
}

export function useAllPhotos() {
  const [photos, setPhotos] = useState<SplashPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const signedIn = useAdminTokenVersion();

  useEffect(() => {
    getAllPhotos()
      .then(setPhotos)
      .finally(() => setLoading(false));
  }, [signedIn]);

  return { photos, loading };
}

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    getPeople()
      .then(setPeople)
      .finally(() => setLoading(false));
  }, [tick]);

  return { people, loading, refresh: () => setTick(t => t + 1) };
}

export function useAreas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getAreas()
      .then(setAreas)
      .finally(() => setLoading(false));
  }, [tick]);

  return { areas, loading, refresh: () => setTick(t => t + 1) };
}

export function usePrefectures() {
  const [prefectures, setPrefectures] = useState<Prefecture[]>([]);
  const [loading, setLoading] = useState(true);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    getPrefectures()
      .then(setPrefectures)
      .finally(() => setLoading(false));
  }, [tick]);

  return { prefectures, loading, refresh: () => setTick(t => t + 1) };
}

export function useCountries() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCountries()
      .then(setCountries)
      .finally(() => setLoading(false));
  }, []);

  return { countries, loading };
}
