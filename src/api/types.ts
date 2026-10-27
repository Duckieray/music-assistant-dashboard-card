export type PlaybackState = "idle" | "playing" | "paused" | "buffering";
export type RepeatMode = "off" | "one" | "all";

export interface MediaItemImage {
  type?: string;
  path: string;
  provider?: string;
  remotely_accessible?: boolean;
  proxy_id?: string | null;
}

export interface ItemMapping {
  item_id: string;
  provider: string;
  name: string;
  media_type?: string;
}

export interface QueueItem {
  queue_id: string;
  queue_item_id: string;
  name: string;
  duration: number | null;
  media_item?: {
    name: string;
    artists?: ItemMapping[];
    album?: ItemMapping;
    image?: MediaItemImage;
    metadata?: { images?: MediaItemImage[] };
    media_type?: string;
  } | null;
  image?: MediaItemImage | null;
}

export interface PlayerQueue {
  queue_id: string;
  active: boolean;
  display_name: string;
  available: boolean;
  items: number;
  shuffle_enabled: boolean;
  repeat_mode: RepeatMode;
  current_index: number | null;
  elapsed_time: number;
  elapsed_time_last_updated: number;
  playback_speed: number;
  state: PlaybackState;
  current_item: QueueItem | null;
  next_item: QueueItem | null;
}

export interface MassPlayer {
  player_id: string;
  name: string;
  display_name?: string;
  available: boolean;
  powered: boolean | null;
  volume_level: number | null;
  volume_muted?: boolean | null;
  playback_state: PlaybackState;
  active_source: string | null;
  active_group?: string | null;
  supported_features: string[];
  group_members: string[];
  static_group_members?: string[];
  can_group_with: string[];
  synced_to: string | null;
}

export interface ServerInfoMessage {
  server_id: string;
  server_version: string;
  schema_version: number;
  min_supported_schema_version: number;
  base_url: string;
  homeassistant_addon: boolean;
  onboarding_done: boolean;
}

export interface MassEvent {
  event: string;
  object_id: string | null;
  data: unknown;
}

export interface SuccessResultMessage {
  message_id: string;
  result: unknown;
  partial?: boolean;
}

export interface ErrorResultMessage {
  message_id: string;
  error_code: number;
  details: string;
}
