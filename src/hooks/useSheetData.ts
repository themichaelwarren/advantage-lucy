import { useState, useEffect } from 'react';
import type { Event, Album, TracklistEntry, Song, SetlistEntry, Venue, Area } from '../types';
import { getEvents, getAllEvents, getAlbums, getTracklists, getSongs, getSetlists, getVenues, getAreas } from '../services/sheetsService';

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

  useEffect(() => {
    getVenues()
      .then(setVenues)
      .finally(() => setLoading(false));
  }, []);

  return { venues, loading };
}

export function useAreas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAreas()
      .then(setAreas)
      .finally(() => setLoading(false));
  }, []);

  return { areas, loading };
}
