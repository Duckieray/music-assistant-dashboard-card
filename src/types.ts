export type NavSection = "listen" | "library" | "playlists" | "radio" | "search";

export interface Player {
  id: string;
  name: string;
  room: string;
  volume: number;
  active: boolean;
  grouped: boolean;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  accent: string;
  secondary: string;
}

export interface MediaItem {
  id: string;
  title: string;
  subtitle: string;
  kind: "playlist" | "album" | "radio" | "artist";
  accent: string;
  secondary: string;
}

export interface DashboardConfig {
  type: string;
  title?: string;
  demo?: boolean;
  default_player?: string;
}

export interface HomeAssistantLike {
  themes?: { darkMode?: boolean };
  callService?: (domain: string, service: string, data?: Record<string, unknown>) => Promise<unknown>;
}
