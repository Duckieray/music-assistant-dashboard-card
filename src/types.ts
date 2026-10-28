export type NavSection = "listen" | "library" | "playlists" | "radio" | "search";

export interface Player {
  id: string;
  name: string;
  room: string;
  volume: number;
  active: boolean;
  grouped: boolean;
  available?: boolean;
  syncedTo?: string | null;
  groupMembers?: string[];
  canGroupWith?: string[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  accent: string;
  secondary: string;
  durationSeconds?: number;
  queueIndex?: number;
  queueItemId?: string;
  imageUrl?: string;
}

export interface MediaItem {
  id: string;
  title: string;
  subtitle: string;
  kind: "playlist" | "album" | "radio" | "artist" | "track";
  accent: string;
  secondary: string;
  /** Music Assistant URI used for playback, e.g. apple_music://playlist/... */
  uri?: string;
  /** Original Music Assistant media type. */
  mediaType?: string;
  /** Resolved artwork URL when available. */
  imageUrl?: string;
  favorite?: boolean;
}

export interface DashboardConfig {
  type: string;
  title?: string;
  demo?: boolean;
  default_player?: string;
  /** Music Assistant server address. Accepts http(s)://host:port or ws(s)://host:port/ws. */
  server_url?: string;
  /** Compatibility alias for server_url. */
  url?: string;
  /** Music Assistant access token created under Settings → Authentication. */
  token?: string;
}

export interface HomeAssistantLike {
  themes?: { darkMode?: boolean };
  callService?: (domain: string, service: string, data?: Record<string, unknown>) => Promise<unknown>;
  callWS?: <T>(message: Record<string, unknown>) => Promise<T>;
}
