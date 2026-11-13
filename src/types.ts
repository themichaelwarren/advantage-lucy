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
  former_ids?: string;   // old ids (addresses) that forward here, comma-separated
  name_en: string;
  name_ja: string;
  area: string;          // area ID
  url?: string;
  /** Old names, one per line: "2003-12 | ON AIR WEST | ON AIR WEST" (functions/lib/venueNames.ts) */
  former_names?: string;
}

// ---------- Core entities ----------

export interface Event {
  id: string;
  former_ids?: string;   // old ids (addresses) that forward here, comma-separated
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
  venue_now_en?: string;   // the venue's name today, when the show was under an older one
  venue_now_ja?: string;
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
  setlist_at?: string;     // setlist goes public then (Japan time, YYYY-MM-DDTHH:mm); blank = day after the show
  setlist_added?: string;  // when the setlist was first entered (YYYY-MM-DD; blank for older ones)
  setlist_source?: string; // admin only: where the setlist was found (a link or a note)
  reserve?: boolean;       // takes ticket reservations through the site
  reserve_cap?: string;    // total tickets that can be reserved (blank = no limit)
  reserve_max?: string;    // most tickets per booking (blank = 4)
  reserve_until?: string;  // reservations close then (Japan time); blank = 23:59 the day before
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
  former_ids?: string;   // old ids (addresses) that forward here, comma-separated
  title: string;
  music_by?: string;     // People ID
  lyrics_by?: string;    // People ID
  lyrics_doc_id?: string;
  original_artist?: string;  // covers: who did it first, e.g. "The Smiths"
  title_en?: string;         // English title (mostly romaji, as on streaming services); shown first on English pages
  title_kana?: string;       // 読み in kana, for 50音順 and search
  status?: string;        // 'private' = draft: no page on the site yet
  lyrics_status?: string; // 'private' = page live, lyrics not shown yet
  about_en?: string;      // about this song, for its page on the site
  about_ja?: string;
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
  publish_at?: string;    // scheduled: goes live then (Japan time, YYYY-MM-DDTHH:mm)
}

export interface BlogPost {
  id: string;
  instagram_url: string;
  date: string;
  title_en: string;
  title_ja: string;
  status?: string;        // 'published' | 'private'
  publish_at?: string;    // scheduled: goes live then (Japan time, YYYY-MM-DDTHH:mm)
}

export interface SplashPhoto {
  id: string;
  image_url: string;
  caption_en?: string;
  caption_ja?: string;
  status?: string;        // 'published' | 'private'
  profile_photo?: string; // 'yes' to use on About page
  share_image?: string;   // 'yes': the picture in link previews of the home page (and pages without their own)
  link?: string;          // where the caption goes: '/events/<id>' (a page on this site) or a full https:// address
}

export interface Album {
  id: string;
  former_ids?: string;   // old ids (addresses) that forward here, comma-separated
  title: string;
  title_en?: string;     // English title (romaji / the English name, as on streaming services)
  title_kana?: string;   // 読み, for 50音順
  date?: string;         // release date YYYY-MM-DD
  year: string;
  type: string;          // 'album' | 'ep' | 'single' | 'compilation'
  number?: string;       // catalog number
  format?: string;       // physical format (CD, vinyl, etc.)
  label?: string;
  coverUrl?: string;
  listenUrl?: string;   // all services (song.link…)
  status?: string;      // 'private' = draft: not on the site yet
  listen?: Partial<Record<import('../functions/lib/listen').ListenService, string>>;
  description_en?: string;
  description_ja?: string;
}
