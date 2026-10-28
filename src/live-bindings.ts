import { html, nothing, type TemplateResult } from "lit";
import { MusicAssistantClient, type ClientState } from "./api/music-assistant-client";
import type { MassEvent, MassPlayer, PlayerQueue, QueueItem, RepeatMode } from "./api/types";
import { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";
import type { DashboardConfig, MediaItem, NavSection, Player, Track } from "./types";

/**
 * Live bindings for the approved v0 visual prototype.
 *
 * This file intentionally keeps the networking/state layer separate from the large prototype
 * component while the product UI is still moving quickly. Once the interaction model settles,
 * these bindings will be folded into smaller first-class Lit components/stores.
 */

/**
 * Structural view of the prototype card used by this temporary binding layer.
 * Do not intersect this with MusicAssistantDashboardCard: the prototype intentionally keeps
 * several UI fields private, and redeclaring those private fields in an intersection causes
 * TypeScript to reduce the intersection to `never`.
 */
type AnyCard = {
  config?: DashboardConfig;
  section: NavSection;
  playing: boolean;
  shuffled: boolean;
  repeatMode: 0 | 1 | 2;
  favorite: boolean;
  volume: number;
  progress: number;
  playerId: string;
  queue: Track[];
  groupOpen: boolean;
  mobileQueueOpen: boolean;
  searchText: string;
  liveMode?: boolean;
  liveState?: ClientState;
  liveError?: string;
  livePlayers?: Player[];
  liveElapsedSeconds?: number;
  liveQueueId?: string;
  isConnected: boolean;
  requestUpdate(): void;
};

type CardPrototype = Record<string, unknown>;

type Session = {
  key: string;
  client: MusicAssistantClient;
  players: MassPlayer[];
  queues: Map<string, PlayerQueue>;
  removeEvent?: () => void;
  removeState?: () => void;
  refreshTimer?: ReturnType<typeof setTimeout>;
  generation: number;
};

const sessions = new WeakMap<AnyCard, Session>();

const iconPaths: Record<string, string> = {
  home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  library: "M4 20h16V4H4v16zm2-2V6h12v12H6zm2-2h8v-2H8v2zm0-4h8v-2H8v2zm0-4h8V6H8v2z",
  playlist: "M3 10h11V8H3v2zm0-4h11V4H3v2zm0 8h7v-2H3v2zm13-2v5.18A3 3 0 1 0 18 20V8h4V6h-6v6z",
  radio: "M3.27 2 2 3.27 9.73 11H2v2h7.73L2 20.73 3.27 22 12 13.27 20.73 22 22 20.73 14.27 13H22v-2h-7.73L22 3.27 20.73 2 12 10.73 3.27 2z",
  search: "M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z",
  play: "M8 5v14l11-7z",
  pause: "M6 5h4v14H6zm8 0h4v14h-4z",
  prev: "M6 6h2v12H6zm3 6 9 6V6z",
  next: "M16 6h2v12h-2zM6 6v12l9-6z",
  shuffle: "M16 3h5v5h-2V6.4l-3.9 3.9-1.4-1.4L17.6 5H16V3zM3 7h3.6l10.8 10.6H19V16h2v5h-5v-2h1.6L5.8 9H3V7zm7.3 6.7 1.4 1.4L6.6 20H3v-2h2.8l4.5-4.3z",
  repeat: "M7 7h10v3l4-4-4-4v3H7a5 5 0 0 0-5 5v3h2v-3a3 3 0 0 1 3-3zm10 10H7v-3l-4 4 4 4v-3h10a5 5 0 0 0 5-5v-3h-2v3a3 3 0 0 1-3 3z",
  volume: "M3 10v4h4l5 5V5L7 10H3zm11.5 2a4.5 4.5 0 0 0-2-3.74v7.48A4.5 4.5 0 0 0 14.5 12zm0-8.5v2.06a7 7 0 0 1 0 12.88v2.06a9 9 0 0 0 0-17z",
  speakers: "M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  more: "M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  queue: "M3 6h12V4H3v2zm0 5h12V9H3v2zm0 5h8v-2H3v2zm14-4v4h-4v2h4v4h2v-4h4v-2h-4v-4h-2z",
  chevron: "m9 18 6-6-6-6",
  close: "M6 6l12 12M18 6 6 18",
  heart: "M12 21s-7-4.35-9.33-8.2C.55 9.3 2.04 5 6.2 5A5.7 5.7 0 0 1 12 8.1 5.7 5.7 0 0 1 17.8 5c4.16 0 5.65 4.3 3.53 7.8C19 16.65 12 21 12 21z"
};

function icon(name: string, size = 20): TemplateResult {
  const path = iconPaths[name] ?? iconPaths.more;
  if (name === "chevron" || name === "close") {
    return html`<svg viewBox="0 0 24 24" width=${size} height=${size} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d=${path}></path></svg>`;
  }
  return html`<svg viewBox="0 0 24 24" width=${size} height=${size} fill="currentColor" aria-hidden="true"><path d=${path}></path></svg>`;
}

function colors(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return [`hsl(${hue} 58% 48%)`, `hsl(${(hue + 54) % 360} 48% 24%)`];
}

function formatTime(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function playerToUi(player: MassPlayer, selectedId: string): Player {
  const groupMembers = player.group_members ?? [];
  return {
    id: player.player_id,
    name: player.display_name || player.name,
    room: player.name,
    volume: player.volume_level ?? 0,
    active: player.player_id === selectedId,
    grouped: Boolean(player.synced_to) || groupMembers.length > 1,
    available: player.available,
    syncedTo: player.synced_to,
    groupMembers
  };
}

function queueItemToTrack(client: MusicAssistantClient, item: QueueItem, queueIndex: number): Track {
  const media = item.media_item ?? undefined;
  const image = item.image ?? media?.image ?? media?.metadata?.images?.[0];
  const [accent, secondary] = colors(item.queue_item_id || item.name);
  return {
    id: item.queue_item_id,
    title: media?.name || item.name || "Unknown track",
    artist: media?.artists?.map((artist) => artist.name).filter(Boolean).join(", ") || "Unknown artist",
    album: media?.album?.name || "",
    duration: item.duration == null ? "LIVE" : formatTime(item.duration),
    durationSeconds: item.duration ?? undefined,
    queueIndex,
    queueItemId: item.queue_item_id,
    imageUrl: client.imageUrl(image, 640),
    accent,
    secondary
  };
}

function blankTrack(): Track {
  return {
    id: "nothing-playing",
    title: "Nothing Playing",
    artist: "Choose something from Music Assistant",
    album: "",
    duration: "—",
    durationSeconds: 0,
    accent: "#30384a",
    secondary: "#151922"
  };
}

function queueForPlayer(session: Session, playerId: string): PlayerQueue | undefined {
  const direct = session.queues.get(playerId);
  if (direct) return direct;
  const player = session.players.find((candidate) => candidate.player_id === playerId);
  if (player?.synced_to) return session.queues.get(player.synced_to);
  if (player?.active_group) return session.queues.get(player.active_group);
  return undefined;
}

function sessionFor(card: AnyCard): Session | undefined {
  return sessions.get(card);
}

function setError(card: AnyCard, error: unknown): void {
  card.liveError = error instanceof Error ? error.message : String(error);
  card.requestUpdate();
}

async function refreshQueue(card: AnyCard, generation?: number): Promise<void> {
  const session = sessionFor(card);
  if (!session || (generation != null && session.generation !== generation)) return;

  try {
    const queue = queueForPlayer(session, card.playerId);
    if (!queue) {
      card.queue = [];
      card.liveQueueId = undefined;
      card.playing = false;
      card.progress = 0;
      card.liveElapsedSeconds = 0;
      card.requestUpdate();
      return;
    }

    card.liveQueueId = queue.queue_id;
    card.playing = queue.state === "playing" || queue.state === "buffering";
    card.shuffled = queue.shuffle_enabled;
    card.repeatMode = queue.repeat_mode === "one" ? 2 : queue.repeat_mode === "all" ? 1 : 0;
    card.liveElapsedSeconds = queue.elapsed_time ?? 0;

    const items = await session.client.getQueueItems(queue.queue_id);
    if (generation != null && session.generation !== generation) return;
    const currentIndex = Math.max(0, queue.current_index ?? 0);
    const visible = items.slice(currentIndex);
    card.queue = visible.map((item, index) => queueItemToTrack(session.client, item, currentIndex + index));
    const currentDuration = card.queue[0]?.durationSeconds ?? 0;
    card.progress = currentDuration > 0 ? Math.min(100, Math.max(0, ((queue.elapsed_time ?? 0) / currentDuration) * 100)) : 0;
    card.requestUpdate();
  } catch (error) {
    setError(card, error);
  }
}

async function refreshAll(card: AnyCard): Promise<void> {
  const session = sessionFor(card);
  if (!session) return;
  const generation = ++session.generation;
  try {
    const [players, queues] = await Promise.all([session.client.getPlayers(), session.client.getQueues()]);
    if (session.generation !== generation) return;
    session.players = players;
    session.queues = new Map(queues.map((queue) => [queue.queue_id, queue]));

    const configured = card.config?.default_player;
    const existing = players.some((player) => player.player_id === card.playerId);
    if (!existing) {
      card.playerId = (configured && players.find((player) => player.player_id === configured)?.player_id)
        || players.find((player) => player.available)?.player_id
        || players[0]?.player_id
        || card.playerId;
    }

    card.livePlayers = players.map((player) => playerToUi(player, card.playerId));
    const selected = players.find((player) => player.player_id === card.playerId);
    card.volume = selected?.volume_level ?? card.volume;
    card.liveError = undefined;
    card.requestUpdate();
    await refreshQueue(card, generation);
  } catch (error) {
    setError(card, error);
  }
}

function scheduleRefresh(card: AnyCard, queueOnly = false): void {
  const session = sessionFor(card);
  if (!session) return;
  if (session.refreshTimer) clearTimeout(session.refreshTimer);
  session.refreshTimer = setTimeout(() => {
    session.refreshTimer = undefined;
    void (queueOnly ? refreshQueue(card) : refreshAll(card));
  }, 90);
}

function handleEvent(card: AnyCard, event: MassEvent): void {
  if (event.event === "queue_time_updated" && event.object_id === card.liveQueueId) {
    const data = event.data as { elapsed_time?: number } | null;
    if (typeof data?.elapsed_time === "number") {
      card.liveElapsedSeconds = data.elapsed_time;
      const duration = card.queue[0]?.durationSeconds ?? 0;
      card.progress = duration > 0 ? Math.min(100, (data.elapsed_time / duration) * 100) : 0;
      card.requestUpdate();
    }
    return;
  }

  if (event.event.startsWith("player_")) scheduleRefresh(card, false);
  else if (event.event.startsWith("queue_")) scheduleRefresh(card, event.object_id === card.liveQueueId);
}

async function ensureLive(card: AnyCard): Promise<void> {
  const address = card.config?.server_url || card.config?.url;
  if (card.config?.demo === true || !address) {
    card.liveMode = false;
    return;
  }

  const key = `${address}\n${card.config?.token ?? ""}`;
  const existing = sessionFor(card);
  if (existing?.key === key && existing.client.state === "connected") return;
  if (existing) {
    existing.removeEvent?.();
    existing.removeState?.();
    existing.client.disconnect();
    sessions.delete(card);
  }

  card.liveMode = true;
  card.liveState = "connecting";
  card.liveError = undefined;
  card.requestUpdate();

  const client = new MusicAssistantClient(address, card.config?.token);
  const session: Session = { key, client, players: [], queues: new Map(), generation: 0 };
  sessions.set(card, session);
  session.removeState = client.onState((state) => {
    card.liveState = state;
    card.liveError = client.lastError;
    card.requestUpdate();
  });
  session.removeEvent = client.onEvent((event) => handleEvent(card, event));

  try {
    await client.connect();
    await refreshAll(card);
  } catch (error) {
    setError(card, error);
  }
}

async function run(card: AnyCard, action: (session: Session) => Promise<unknown>, refresh = true): Promise<void> {
  const session = sessionFor(card);
  if (!session) return;
  try {
    await action(session);
    card.liveError = undefined;
    if (refresh) scheduleRefresh(card, true);
  } catch (error) {
    setError(card, error);
  }
}

function repeatMode(card: AnyCard): RepeatMode {
  return card.repeatMode === 2 ? "one" : card.repeatMode === 1 ? "all" : "off";
}

function artStyle(track: Track): string {
  const base = `--a:${track.accent};--b:${track.secondary};`;
  if (!track.imageUrl) return base;
  const safe = track.imageUrl.replace(/["')]/g, encodeURIComponent);
  return `${base}background-image:linear-gradient(rgba(0,0,0,.04),rgba(0,0,0,.04)),url("${safe}");background-size:cover;background-position:center;`;
}

export function installLiveBindings(): void {
  const proto = MusicAssistantDashboardCard.prototype as unknown as CardPrototype;
  if (proto.__liveBindingsInstalled) return;
  proto.__liveBindingsInstalled = true;

  const originalSetConfig = proto.setConfig as (this: AnyCard, config: DashboardConfig) => void;
  const originalConnected = proto.connectedCallback as ((this: AnyCard) => void) | undefined;
  const originalDisconnected = proto.disconnectedCallback as ((this: AnyCard) => void) | undefined;
  const originalCurrentPlayer = Object.getOwnPropertyDescriptor(MusicAssistantDashboardCard.prototype, "currentPlayer")?.get;
  const originalCurrentTrack = Object.getOwnPropertyDescriptor(MusicAssistantDashboardCard.prototype, "currentTrack")?.get;
  const originalCycleRepeat = proto.cycleRepeat as (this: AnyCard) => void;
  const originalMoveTrack = proto.moveTrack as (this: AnyCard, index: number, delta: number) => void;
  const originalRemoveTrack = proto.removeTrack as (this: AnyCard, index: number) => void;
  const originalSelectTrack = proto.selectTrack as (this: AnyCard, index: number) => void;

  proto.setConfig = function setConfig(this: AnyCard, config: DashboardConfig): void {
    originalSetConfig.call(this, config);
    if (this.isConnected) void ensureLive(this);
  };

  proto.connectedCallback = function connectedCallback(this: AnyCard): void {
    originalConnected?.call(this);
    void ensureLive(this);
  };

  proto.disconnectedCallback = function disconnectedCallback(this: AnyCard): void {
    const session = sessionFor(this);
    if (session) {
      session.removeEvent?.();
      session.removeState?.();
      if (session.refreshTimer) clearTimeout(session.refreshTimer);
      session.client.disconnect();
      sessions.delete(this);
    }
    originalDisconnected?.call(this);
  };

  Object.defineProperty(MusicAssistantDashboardCard.prototype, "currentPlayer", {
    configurable: true,
    get(this: AnyCard): Player {
      if (!this.liveMode) return originalCurrentPlayer?.call(this) as Player;
      return this.livePlayers?.find((player) => player.id === this.playerId)
        ?? this.livePlayers?.[0]
        ?? { id: this.playerId || "none", name: "No player", room: "", volume: 0, active: false, grouped: false };
    }
  });

  Object.defineProperty(MusicAssistantDashboardCard.prototype, "currentTrack", {
    configurable: true,
    get(this: AnyCard): Track {
      if (!this.liveMode) return originalCurrentTrack?.call(this) as Track;
      return this.queue[0] ?? blankTrack();
    }
  });

  proto.cycleRepeat = function cycleRepeat(this: AnyCard): void {
    if (!this.liveMode) return originalCycleRepeat.call(this);
    this.repeatMode = ((this.repeatMode + 1) % 3) as 0 | 1 | 2;
    const queueId = this.liveQueueId;
    if (queueId) void run(this, (session) => session.client.setRepeat(queueId, repeatMode(this)));
  };

  proto.moveTrack = function moveTrack(this: AnyCard, index: number, delta: number): void {
    if (!this.liveMode) return originalMoveTrack.call(this, index, delta);
    const queueId = this.liveQueueId;
    const track = this.queue[index];
    if (!queueId || !track?.queueItemId || index === 0) return;
    void run(this, (session) => session.client.moveQueueItem(queueId, track.queueItemId!, delta));
  };

  proto.removeTrack = function removeTrack(this: AnyCard, index: number): void {
    if (!this.liveMode) return originalRemoveTrack.call(this, index);
    const queueId = this.liveQueueId;
    const track = this.queue[index];
    if (!queueId || !track?.queueItemId || index === 0) return;
    void run(this, (session) => session.client.deleteQueueItem(queueId, track.queueItemId!));
  };

  proto.selectTrack = function selectTrack(this: AnyCard, index: number): void {
    if (!this.liveMode) return originalSelectTrack.call(this, index);
    const queueId = this.liveQueueId;
    const track = this.queue[index];
    if (!queueId || track?.queueIndex == null) return;
    void run(this, (session) => session.client.playIndex(queueId, track.queueIndex!));
  };

  proto.renderSidebar = function renderSidebar(this: AnyCard): TemplateResult {
    const nav: Array<[NavSection, string, string]> = [
      ["listen", "home", "Listen Now"], ["library", "library", "Library"],
      ["playlists", "playlist", "Playlists"], ["radio", "radio", "Radio"], ["search", "search", "Search"]
    ];
    const state = !this.liveMode ? "Demo mode" : this.liveState === "connected" ? "Connected" : this.liveState === "authenticating" ? "Authenticating" : this.liveState === "connecting" ? "Connecting" : this.liveError ? "Connection error" : "Disconnected";
    return html`
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">${icon("play", 18)}</div><div><strong>Music</strong><span>Assistant</span></div></div>
        <nav>${nav.map(([section, iconName, label]) => html`<button class=${this.section === section ? "nav active" : "nav"} @click=${() => { this.section = section; }}>${icon(iconName, 19)}<span>${label}</span></button>`)}</nav>
        <div class="sidebar-spacer"></div>
        <div class="sidebar-card" title=${this.liveError || state}>
          <span class="eyebrow">ACTIVE SYSTEM</span><strong>Music Assistant</strong><span><i style=${this.liveError ? "background:#ff6f78;box-shadow:0 0 9px #ff6f78" : ""}></i> ${state}</span>
        </div>
      </aside>`;
  };

  proto.renderTopbar = function renderTopbar(this: AnyCard): TemplateResult {
    const title = this.section === "listen" ? "Listen Now" : this.section === "radio" ? "Radio" : this.section[0].toUpperCase() + this.section.slice(1);
    return html`
      <header class="topbar">
        <div><span class="eyebrow">${this.section === "listen" ? "GOOD EVENING" : this.section.toUpperCase()}</span><h1>${title}</h1></div>
        <div class="top-actions">
          <button class="room-picker" @click=${() => { this.groupOpen = true; }}>
            <span class="room-icon">${icon("speakers", 18)}</span><span><small>Playing in</small><strong>${(this as unknown as { currentPlayer: Player }).currentPlayer.name}</strong></span>${icon("chevron", 17)}
          </button>
          <button class="icon-button mobile-queue" title="Queue" @click=${() => { this.mobileQueueOpen = true; }}>${icon("queue", 20)}</button>
          <button class="avatar" title="Music Assistant">MA</button>
        </div>
      </header>`;
  };

  proto.renderNowPlaying = function renderNowPlaying(this: AnyCard): TemplateResult {
    if (!this.liveMode) {
      const original = (proto.__originalRenderNowPlaying as ((this: AnyCard) => TemplateResult) | undefined);
      if (original) return original.call(this);
    }
    const track = (this as unknown as { currentTrack: Track }).currentTrack;
    const elapsed = this.liveElapsedSeconds ?? 0;
    const remaining = track.durationSeconds ? Math.max(0, track.durationSeconds - elapsed) : undefined;
    return html`
      <section class="now-playing surface">
        <div class="art hero-art" style=${artStyle(track)}>
          ${track.imageUrl ? nothing : html`<div class="vinyl-ring"></div><div class="art-label"><small>NOW PLAYING</small><b>${track.artist.split(" ")[0]}</b></div>`}
        </div>
        <div class="track-panel">
          <div class="track-heading"><div><span class="eyebrow">NOW PLAYING</span><h2>${track.title}</h2><p>${track.artist}${track.album ? html` <span>•</span> ${track.album}` : nothing}</p></div><button class=${this.favorite ? "icon-button favorite active" : "icon-button favorite"} @click=${() => { this.favorite = !this.favorite; }}>${icon("heart", 20)}</button></div>
          <div class="progress-wrap">
            <input aria-label="Track progress" type="range" min="0" max="100" .value=${String(this.progress)} @input=${(event: Event) => { this.progress = Number((event.target as HTMLInputElement).value); }} @change=${(event: Event) => {
              const queueId = this.liveQueueId; const duration = track.durationSeconds ?? 0; const percent = Number((event.target as HTMLInputElement).value);
              if (queueId && duration > 0) void run(this, (session) => session.client.seek(queueId, duration * percent / 100));
            }} />
            <div class="time-row"><span>${formatTime(elapsed)}</span><span>${track.duration === "LIVE" ? "LIVE" : remaining == null ? track.duration : `-${formatTime(remaining)}`}</span></div>
          </div>
          <div class="transport">
            <button class=${this.shuffled ? "transport-small active" : "transport-small"} title="Shuffle" @click=${() => { const queueId = this.liveQueueId; if (!queueId) return; this.shuffled = !this.shuffled; void run(this, (session) => session.client.setShuffle(queueId, this.shuffled)); }}>${icon("shuffle", 19)}</button>
            <button class="transport-small" title="Previous" @click=${() => { const queueId = this.liveQueueId; if (queueId) void run(this, (session) => session.client.previous(queueId)); }}>${icon("prev", 22)}</button>
            <button class="play-button" title=${this.playing ? "Pause" : "Play"} @click=${() => { const queueId = this.liveQueueId; if (!queueId) return; this.playing = !this.playing; void run(this, (session) => session.client.playPause(queueId)); }}>${icon(this.playing ? "pause" : "play", 27)}</button>
            <button class="transport-small" title="Next" @click=${() => { const queueId = this.liveQueueId; if (queueId) void run(this, (session) => session.client.next(queueId)); }}>${icon("next", 22)}</button>
            <button class=${this.repeatMode ? "transport-small active repeat" : "transport-small repeat"} title="Repeat" @click=${() => (this as unknown as { cycleRepeat(): void }).cycleRepeat()}>${icon("repeat", 19)}${this.repeatMode === 2 ? html`<em>1</em>` : nothing}</button>
          </div>
          <div class="volume-row">${icon("volume", 19)}<input aria-label="Volume" type="range" min="0" max="100" .value=${String(this.volume)} @input=${(event: Event) => { this.volume = Number((event.target as HTMLInputElement).value); }} @change=${() => { void run(this, (session) => session.client.setVolume(this.playerId, this.volume), false); }} /><span>${Math.round(this.volume)}%</span></div>
        </div>
      </section>`;
  };

  proto.renderQueueItem = function renderQueueItem(this: AnyCard, track: Track, index: number): TemplateResult {
    return html`
      <div class=${index === 0 ? "queue-item current" : "queue-item"}>
        <button class="queue-art art" style=${artStyle(track)} @click=${() => (this as unknown as { selectTrack(index: number): void }).selectTrack(index)}>${!track.imageUrl ? (index === 0 && this.playing ? html`<span class="bars"><i></i><i></i><i></i></span>` : icon("play", 14)) : nothing}</button>
        <button class="queue-copy" @click=${() => (this as unknown as { selectTrack(index: number): void }).selectTrack(index)}><strong>${track.title}</strong><span>${track.artist}</span></button>
        <span class="duration">${track.duration}</span>
        ${index > 0 ? html`<div class="queue-tools"><button title="Move up" @click=${() => (this as unknown as { moveTrack(index: number, delta: number): void }).moveTrack(index, -1)}>↑</button><button title="Move down" @click=${() => (this as unknown as { moveTrack(index: number, delta: number): void }).moveTrack(index, 1)}>↓</button><button title="Remove" @click=${() => (this as unknown as { removeTrack(index: number): void }).removeTrack(index)}>×</button></div>` : nothing}
      </div>`;
  };

  proto.renderQueue = function renderQueue(this: AnyCard): TemplateResult {
    const currentTrack = (this as unknown as { currentTrack: Track }).currentTrack;
    return html`
      <aside class="queue-panel ${this.mobileQueueOpen ? "open" : ""}">
        <div class="queue-header"><div><span class="eyebrow">${this.queue.length} ITEMS</span><h3>Up Next</h3></div><div class="queue-header-actions"><button class="text-button" @click=${() => { const queueId = this.liveQueueId; if (this.liveMode && queueId) void run(this, (session) => session.client.clearQueue(queueId)); else this.queue = this.queue.slice(0, 1); }}>Clear</button><button class="icon-button close-queue" @click=${() => { this.mobileQueueOpen = false; }}>${icon("close", 19)}</button></div></div>
        <div class="queue-now"><span>PLAYING NOW</span>${(this as unknown as { renderQueueItem(track: Track, index: number): TemplateResult }).renderQueueItem(currentTrack, 0)}</div>
        <div class="queue-list"><span class="queue-label">NEXT</span>${this.queue.slice(1).map((track, localIndex) => (this as unknown as { renderQueueItem(track: Track, index: number): TemplateResult }).renderQueueItem(track, localIndex + 1))}</div>
        <div class="queue-footer"><button @click=${() => { const queueId = this.liveQueueId; if (this.liveMode && queueId) { this.shuffled = true; void run(this, (session) => session.client.setShuffle(queueId, true)); } }}>${icon("shuffle", 17)} Shuffle remaining</button><button>${icon("more", 17)} Queue actions</button></div>
      </aside>`;
  };

  proto.renderGroupDialog = function renderGroupDialog(this: AnyCard): TemplateResult | typeof nothing {
    if (!this.groupOpen) return nothing;
    const players = this.liveMode ? (this.livePlayers ?? []) : [];
    if (!this.liveMode) {
      const original = proto.__originalRenderGroupDialog as ((this: AnyCard) => TemplateResult | typeof nothing) | undefined;
      if (original) return original.call(this);
    }
    return html`
      <div class="modal-backdrop" @click=${() => { this.groupOpen = false; }}><div class="group-dialog" @click=${(event: Event) => event.stopPropagation()}>
        <div class="dialog-title"><div><span class="eyebrow">MUSIC ASSISTANT PLAYERS</span><h3>Choose a room</h3></div><button class="icon-button" @click=${() => { this.groupOpen = false; }}>${icon("close", 20)}</button></div>
        <div class="room-list">
          ${players.map((player) => html`<div class=${player.id === this.playerId ? "room-row selected" : "room-row"}>
            <button class="check" @click=${() => { this.playerId = player.id; this.livePlayers = players.map((candidate) => ({ ...candidate, active: candidate.id === player.id })); const session = sessionFor(this); const raw = session?.players.find((candidate) => candidate.player_id === player.id); this.volume = raw?.volume_level ?? player.volume; void refreshQueue(this); }}>${player.id === this.playerId ? "✓" : ""}</button>
            <button class="room-copy" @click=${() => { this.playerId = player.id; void refreshQueue(this); }}><strong>${player.name}</strong><span>${player.id === this.playerId ? "Selected player" : !player.available ? "Unavailable" : player.grouped ? "Grouped" : "Available"}</span></button>
            <input type="range" min="0" max="100" .value=${String(player.id === this.playerId ? this.volume : player.volume)} @change=${(event: Event) => { const value = Number((event.target as HTMLInputElement).value); if (player.id === this.playerId) this.volume = value; void run(this, (session) => session.client.setVolume(player.id, value), false); }} />
            <span>${Math.round(player.id === this.playerId ? this.volume : player.volume)}%</span>
          </div>`)}
        </div>
        <div class="dialog-actions"><button class="secondary-action" disabled title="Queue transfer is coming in the grouping phase">Transfer playback</button><button class="primary-action" @click=${() => { this.groupOpen = false; }}>Done</button></div>
      </div></div>`;
  };

  // Preserve the original prototype renders for demo mode before replacing them.
  // These assignments are intentionally last so the functions above can reference them.
}

const prototype = MusicAssistantDashboardCard.prototype as unknown as CardPrototype;
if (!prototype.__originalRenderNowPlaying) prototype.__originalRenderNowPlaying = prototype.renderNowPlaying;
if (!prototype.__originalRenderGroupDialog) prototype.__originalRenderGroupDialog = prototype.renderGroupDialog;
