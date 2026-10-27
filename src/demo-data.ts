import type { MediaItem, Player, Track } from "./types";

export const demoPlayers: Player[] = [
  { id: "pool-room", name: "Pool Room", room: "Pool Room", volume: 46, active: true, grouped: true },
  { id: "kitchen", name: "Kitchen", room: "Kitchen", volume: 31, active: false, grouped: true },
  { id: "living-room", name: "Living Room", room: "Living Room", volume: 54, active: false, grouped: false },
  { id: "bedroom", name: "Bedroom", room: "Bedroom", volume: 22, active: false, grouped: false }
];

export const demoQueue: Track[] = [
  { id: "track-1", title: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", duration: "4:03", accent: "#8f7cff", secondary: "#ef7aa7" },
  { id: "track-2", title: "Bangarang", artist: "Skrillex feat. Sirah", album: "Bangarang", duration: "3:35", accent: "#f15a44", secondary: "#6a2c91" },
  { id: "track-3", title: "Brand New Bitch", artist: "Cobrah", album: "Brand New Bitch", duration: "3:20", accent: "#e653a6", secondary: "#4e2683" },
  { id: "track-4", title: "Five Hours", artist: "Deorro", album: "Five Hours", duration: "5:26", accent: "#ff9b3f", secondary: "#f04665" },
  { id: "track-5", title: "Bump Bump Bump", artist: "Wax Motif", album: "House of Wax", duration: "3:08", accent: "#42b9b1", secondary: "#214a8c" },
  { id: "track-6", title: "Ctrl Walt Delete", artist: "Showtek", album: "Analogue Players", duration: "4:11", accent: "#6f73ff", secondary: "#32c5cf" }
];

export const recentlyPlayed: MediaItem[] = [
  { id: "recent-1", title: "Pool Room Mix", subtitle: "Playlist • 84 songs", kind: "playlist", accent: "#635bff", secondary: "#ab63fa" },
  { id: "recent-2", title: "DanceXL", subtitle: "Apple Music Dance", kind: "radio", accent: "#e14b7b", secondary: "#ff9a57" },
  { id: "recent-3", title: "Hurry Up, We're Dreaming", subtitle: "M83", kind: "album", accent: "#f06b69", secondary: "#6f4cc7" },
  { id: "recent-4", title: "Skrillex", subtitle: "Artist Station", kind: "radio", accent: "#202442", secondary: "#e53a58" },
  { id: "recent-5", title: "Workout", subtitle: "Made for you", kind: "playlist", accent: "#45a48d", secondary: "#0f3f53" }
];

export const playlists: MediaItem[] = [
  { id: "playlist-1", title: "Favorites", subtitle: "112 songs", kind: "playlist", accent: "#ec4c72", secondary: "#7c3d9d" },
  { id: "playlist-2", title: "Thumping", subtitle: "38 songs", kind: "playlist", accent: "#9b43d1", secondary: "#412bb7" },
  { id: "playlist-3", title: "Pool Night", subtitle: "52 songs", kind: "playlist", accent: "#3e70dc", secondary: "#55c6b4" },
  { id: "playlist-4", title: "Discoveries", subtitle: "Recently added", kind: "playlist", accent: "#ef8246", secondary: "#c33764" },
  { id: "playlist-5", title: "Late Night", subtitle: "41 songs", kind: "playlist", accent: "#263561", secondary: "#4f69b7" }
];

export const radioItems: MediaItem[] = [
  { id: "radio-1", title: "Skrillex Station", subtitle: "Artist radio", kind: "radio", accent: "#271f44", secondary: "#e83a63" },
  { id: "radio-2", title: "DanceXL", subtitle: "Apple Music", kind: "radio", accent: "#db3c84", secondary: "#ff9345" },
  { id: "radio-3", title: "Electronic Chill", subtitle: "Endless mix", kind: "radio", accent: "#247a81", secondary: "#162d57" },
  { id: "radio-4", title: "House Station", subtitle: "Music Assistant", kind: "radio", accent: "#7354c5", secondary: "#2b3a84" },
  { id: "radio-5", title: "New Music Mix", subtitle: "Recommended", kind: "radio", accent: "#c84f64", secondary: "#e3a448" }
];
