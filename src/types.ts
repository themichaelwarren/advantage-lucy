// ---------- Reference tables ----------

export interface Country {
  id: string;
  name_en: string;
  name_ja: string;
}

export interface Prefecture {
  id: string;
  name_en: string;
  name_ja: string;
  country: string;       // country ID
}

export interface Area {
  id: string;
  name_en: string;
  name_ja: string;
  prefecture: string;    // prefecture ID
}

export interface Venue {
  id: string;
  name_en: string;
  name_ja: string;
  area: string;          // area ID
  url?: string;
}

// ---------- Core entities ----------

export interface Event {
  id: string;
  title_en: string;
  title_ja: string;
  date: string;            // ISO date string YYYY-MM-DD
  end_date?: string;
  doors?: string;          // e.g. "18:00"
  start?: string;          // e.g. "19:00"
  end_time?: string;       // e.g. "21:30"
  adv_price?: string;      // advance price
  door_price?: string;     // at the door
  venue_id?: string;       // raw venue ID from sheet
  venue_en: string;        // resolved from Venues join
  venue_ja: string;
  venue_url?: string;      // venue website/map
  city_en: string;         // resolved from Areas join (area name)
  city_ja: string;
  prefecture_en?: string;  // resolved from Prefectures join
  prefecture_ja?: string;
  country_en?: string;     // resolved from Countries join
  country_ja?: string;
  ticketUrl?: string;
  performers?: string;
  posterUrl?: string;
  featured?: boolean;
  status?: string;         // 'published' | 'private' — private = draft, hidden from public site
  body_en?: string;
  body_ja?: string;
}

export interface TracklistEntry {
  release: string;       // album title (joins to Album.title)
  track: number;         // track number
  title: string;         // song title (joins to Songs tab)
}

export interface Person {
  id: string;
  name_family_en: string;
  name_given_en: string;
  name_family_ja: string;
  name_given_ja: string;
}

export interface Song {
  id: string;
  title: string;
  music_by?: string;     // People ID
  lyrics_by?: string;    // People ID
  lyrics_doc_id?: string;
}

export interface SetlistEntry {
  event: string;       // event ID (joins to Event.id)
  song: string;        // song title (joins to Song.title)
  set: string;         // "1", "2", "e" (encore), etc.
  order: number;       // position within set
  notes?: string;      // small note about this performance
  status?: string;    // 'published' | 'private'
}

export interface NewsPost {
  id: string;
  date: string;           // YYYY-MM-DD
  title_en: string;
  title_ja: string;
  body_en?: string;
  body_ja?: string;
  image_url?: string;
  status?: string;        // 'published' | 'private'
}

export interface Album {
  id: string;
  title: string;
  date?: string;         // release date YYYY-MM-DD
  year: string;
  type: string;          // 'album' | 'ep' | 'single' | 'compilation'
  number?: string;       // catalog number
  format?: string;       // physical format (CD, vinyl, etc.)
  label?: string;
  coverUrl?: string;
  listenUrl?: string;
  description_en?: string;
  description_ja?: string;
}
