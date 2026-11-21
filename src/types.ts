// ---- IPTV (iptv-org style schema, every field treated as optional at runtime) ----
export interface Channel {
  id: string;
  name: string;
  alt_names?: string[];
  network?: string | null;
  country?: string;
  categories?: string[];
  logo?: string | null;
  is_nsfw?: boolean;
  closed?: string | null;
  website?: string | null;
  image?: string | null; // thumbnail / cover shown on cards and the home hero
  featured?: boolean;    // show on the home hero
  custom?: boolean;      // added by you in custom-channels.json
}
export interface Stream {
  channel?: string | null;
  feed?: string | null;
  title?: string;
  url: string;
  quality?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
}
export interface GuideEntry {
  channel?: string | null;
  feed?: string | null;
  site?: string;
  site_id?: string;
  site_name?: string;
  lang?: string;
  site_lang?: string;
  // Present only if the proxy returns real programme data:
  title?: string;
  description?: string;
  start?: string | number;
  stop?: string | number;
  image?: string;
  icon?: string;
  poster?: string;
  thumbnail?: string;
}
export interface Category { id: string; name: string }
export interface Country { name: string; code: string; languages?: string[]; flag?: string }
export interface Language { name: string; code: string }
export interface Region { code: string; name: string; countries?: string[] }
export interface Timezone { id: string; utc_offset?: string; countries?: string[] }
export interface BlockItem { channel?: string; ref?: string }

export interface LiveChannel extends Channel {
  streams: Stream[];
  quality?: string;
  languages: string[];
}

// ---- DramaBox (normalised from whatever shape the API returns) ----
export interface DramaEpisode { index: number; title: string; url?: string; cover?: string }
export interface Drama {
  id: string;
  title: string;
  description?: string;
  poster?: string;
  tags: string[];
  episodes: DramaEpisode[];
  episodeCount?: number;
  raw: unknown;
}

// ---- User data ----
export interface Fav {
  key: string; // `${type}:${id}`
  type: 'channel' | 'drama';
  id: string;
  title: string;
  image?: string;
  sub?: string;
}
export interface HistItem extends Fav { ts: number; ep?: number }
export interface Progress {
  dramaId: string; title: string; image?: string;
  ep: number; time: number; duration: number; ts: number;
}

// ---- Backend ----
export interface FeaturedItem { id: string; type: 'drama' | 'channel'; title: string; image?: string }
export interface PublicConfig {
  settings: { announcement: string; maintenance: boolean };
  featured: FeaturedItem[];
  hidden: string[]; // `${type}:${id}`
}
