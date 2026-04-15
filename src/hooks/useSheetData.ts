import { useState, useEffect } from 'react';
import type { Event, Album, TracklistEntry, Song, SetlistEntry, Venue, Area, Person, NewsPost, BlogPost, SplashPhoto } from '../types';
import { getEvents, getAllEvents, getAlbums, getTracklists, getSongs, getSetlists, getNews, getAllNews, getBlog, getAllBlog, getPhotos, getAllPhotos, getVenues, getAreas, getPeople } from '../services/sheetsService';

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

  useEffect(() => {
    getAllEvents()
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

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

  useEffect(() => {
    getTracklists()
      .then(setTracklists)
      .finally(() => setLoading(false));
  }, []);

  return { tracklists, loading };
}

export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSongs()
      .then(setSongs)
      .finally(() => setLoading(false));
  }, []);

  return { songs, loading };
}

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

  useEffect(() => {
    getAllNews()
      .then(setNews)
      .finally(() => setLoading(false));
  }, []);

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

  useEffect(() => {
    getAllBlog()
      .then(setBlog)
      .finally(() => setLoading(false));
  }, []);

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

  useEffect(() => {
    getAllPhotos()
      .then(setPhotos)
      .finally(() => setLoading(false));
  }, []);

  return { photos, loading };
}

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPeople()
      .then(setPeople)
      .finally(() => setLoading(false));
  }, []);

  return { people, loading };
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
