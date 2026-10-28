import { html, nothing, type TemplateResult } from "lit";
import { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";
import type { DashboardConfig, MediaItem, NavSection, Track } from "./types";

const BRIDGE_ADDRESS = "ha-music-assistant-dashboard-bridge";
const IMAGE_PROXY_PREFIX = "/music-assistant-dashboard/image/";

type BridgeHass = {
  callWS<T>(message: Record<string, unknown>): Promise<T>;
};

type RawImage = {
  path?: string;
  proxy_id?: string | null;
  remotely_accessible?: boolean;
};

type RawMediaItem = {
  uri?: string;
  name?: string;
  media_type?: string;
  image?: RawImage | string | null;
  metadata?: { images?: RawImage[] } | null;
};

type RawSearchResults = {
  artists?: RawMediaItem[];
  albums?: RawMediaItem[];
  tracks?: RawMediaItem[];
  playlists?: RawMediaItem[];
  radio?: RawMediaItem[];
  radios?: RawMediaItem[];
};

type PolishCard = {
  hass?: BridgeHass;
  config?: DashboardConfig;
  liveMode?: boolean;
  section: NavSection;
  playing: boolean;
  playerId: string;
  liveQueueId?: string;
  queue: Track[];
  mobileQueueOpen: boolean;
  groupOpen: boolean;
  livePlayers?: Array<{ id: string; name: string; active: boolean }>;
  requestUpdate(): void;
};

type CardPrototype = Record<string, unknown>;

type ImageCache = Map<string, string | null>;
const imageCaches = new WeakMap<PolishCard, ImageCache>();
const imageRequests = new WeakMap<PolishCard, Set<string>>();

function isBridgeCard(card: PolishCard): boolean {
  return card.liveMode === true
    && (card.config?.server_url === BRIDGE_ADDRESS || card.config?.url === BRIDGE_ADDRESS)
    && typeof card.hass?.callWS === "function";
}

function currentTrack(card: PolishCard): Track {
  return (card as unknown as { currentTrack: Track }).currentTrack;
}

function imageFromRaw(item?: RawMediaItem): string | undefined {
  if (!item) return undefined;
  const image = item.image ?? item.metadata?.images?.[0];
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (image.proxy_id) {
    return `${IMAGE_PROXY_PREFIX}${encodeURIComponent(image.proxy_id)}?size=640`;
  }
  if (image.remotely_accessible && image.path) return image.path;
  if (image.path?.startsWith("https://")) return image.path;
  return undefined;
}

function allSearchItems(result: RawSearchResults): RawMediaItem[] {
  return [
    ...(result.tracks ?? []),
    ...(result.albums ?? []),
    ...(result.artists ?? []),
    ...(result.playlists ?? []),
    ...(result.radio ?? result.radios ?? []),
  ];
}

function findArtworkResult(item: MediaItem, result: RawSearchResults): RawMediaItem | undefined {
  const candidates = allSearchItems(result);
  if (item.uri) {
    const exactUri = candidates.find((candidate) => candidate.uri === item.uri);
    if (exactUri && imageFromRaw(exactUri)) return exactUri;
  }

  const title = item.title.trim().toLocaleLowerCase();
  const type = item.mediaType ?? item.kind;
  return candidates.find((candidate) =>
    candidate.name?.trim().toLocaleLowerCase() === title
    && candidate.media_type === type
    && Boolean(imageFromRaw(candidate)),
  ) ?? candidates.find((candidate) =>
    candidate.name?.trim().toLocaleLowerCase() === title
    && Boolean(imageFromRaw(candidate)),
  );
}

function imageKey(item: MediaItem): string {
  return item.uri || item.id;
}

function requestMissingArtwork(card: PolishCard, item: MediaItem): void {
  if (!isBridgeCard(card) || item.imageUrl) return;
  const key = imageKey(item);
  let cache = imageCaches.get(card);
  if (!cache) {
    cache = new Map<string, string | null>();
    imageCaches.set(card, cache);
  }
  if (cache.has(key)) return;

  let requests = imageRequests.get(card);
  if (!requests) {
    requests = new Set<string>();
    imageRequests.set(card, requests);
  }
  if (requests.has(key)) return;
  requests.add(key);

  void card.hass!.callWS<RawSearchResults>({
    type: "music_assistant_dashboard/search",
    query: item.title,
    limit: 10,
    library_only: false,
  }).then((result) => {
    const match = findArtworkResult(item, result);
    cache!.set(key, imageFromRaw(match) ?? null);
  }).catch(() => {
    cache!.set(key, null);
  }).finally(() => {
    requests!.delete(key);
    card.requestUpdate();
  });
}

function resolvedArtwork(card: PolishCard, item: MediaItem): string | undefined {
  return item.imageUrl || imageCaches.get(card)?.get(imageKey(item)) || undefined;
}

function trackArtStyle(track: Track): string {
  const base = `--a:${track.accent};--b:${track.secondary};`;
  if (!track.imageUrl) return base;
  const safe = track.imageUrl.replace(/["')]/g, encodeURIComponent);
  return `${base}background-image:linear-gradient(rgba(0,0,0,.04),rgba(0,0,0,.04)),url("${safe}");background-size:cover;background-position:center;`;
}

async function command(card: PolishCard, action: string, args: Record<string, unknown>): Promise<void> {
  if (!isBridgeCard(card)) return;
  try {
    await card.hass!.callWS({
      type: "music_assistant_dashboard/command",
      action,
      args,
    });
  } catch {
    // The normal live bindings surface connection errors and refresh state.
  }
}

function miniPlayer(card: PolishCard): TemplateResult | typeof nothing {
  if (!isBridgeCard(card) || card.section === "listen") return nothing;
  const track = currentTrack(card);
  const player = card.livePlayers?.find((candidate) => candidate.id === card.playerId);
  const queueId = card.liveQueueId;

  return html`
    <section class="compact-player surface" aria-label="Now playing">
      <div class="compact-art art" style=${trackArtStyle(track)}></div>
      <button class="compact-copy" title="Now playing: ${track.title}" @click=${() => { card.section = "listen"; card.requestUpdate(); }}>
        <span class="eyebrow">NOW PLAYING${player?.name ? ` • ${player.name}` : ""}</span>
        <strong>${track.title}</strong>
        <small>${track.artist}</small>
      </button>
      <div class="compact-controls">
        <button title="Previous" @click=${() => { if (queueId) void command(card, "previous", { queue_id: queueId }); }}>‹‹</button>
        <button class="compact-play" title=${card.playing ? "Pause" : "Play"} @click=${() => {
          if (!queueId) return;
          card.playing = !card.playing;
          card.requestUpdate();
          void command(card, "play_pause", { queue_id: queueId });
        }}>${card.playing ? "Ⅱ" : "▶"}</button>
        <button title="Next" @click=${() => { if (queueId) void command(card, "next", { queue_id: queueId }); }}>››</button>
        <button class="compact-room" title="Rooms & grouping" @click=${() => { card.groupOpen = true; card.requestUpdate(); }}>▣</button>
        <button class="compact-queue" title="Open queue" @click=${() => { card.mobileQueueOpen = true; card.requestUpdate(); }}>☷</button>
      </div>
    </section>
    <style>
      .compact-player {
        min-height:72px;
        margin:2px 0 22px;
        padding:10px 12px;
        display:grid;
        grid-template-columns:52px minmax(0,1fr) auto;
        align-items:center;
        gap:12px;
        position:sticky;
        top:8px;
        z-index:24;
        backdrop-filter:blur(18px);
        box-shadow:0 12px 30px rgba(0,0,0,.18);
      }
      .compact-art { width:52px;height:52px;border-radius:10px;box-shadow:0 7px 18px rgba(0,0,0,.22); }
      .compact-copy { min-width:0;border:0;background:transparent;text-align:left;padding:0;cursor:pointer; }
      .compact-copy span,.compact-copy strong,.compact-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .compact-copy strong{font-size:13px;margin:3px 0 2px}.compact-copy small{font-size:10px;color:var(--muted)}
      .compact-controls{display:flex;align-items:center;gap:5px}
      .compact-controls button{width:38px;height:38px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.035);color:var(--soft);display:grid;place-items:center;cursor:pointer;font-weight:800}
      .compact-controls button:hover{background:rgba(255,255,255,.08);color:var(--text)}
      .compact-controls .compact-play{width:42px;height:42px;border-radius:50%;background:#fff;color:#10131b;border-color:#fff}
      @media (max-width:650px){
        .compact-player{top:4px;min-height:64px;margin:0 0 16px;padding:8px;grid-template-columns:46px minmax(0,1fr) auto;gap:9px;border-radius:14px}
        .compact-art{width:46px;height:46px;border-radius:9px}
        .compact-copy .eyebrow{display:none}.compact-copy strong{font-size:12px;margin:0 0 3px}.compact-copy small{font-size:9px}
        .compact-controls{gap:3px}.compact-controls button{width:36px;height:36px;border-radius:10px}.compact-controls .compact-play{width:38px;height:38px}
        .compact-controls button:first-child,.compact-room{display:none!important}
      }
    </style>
  `;
}

export function installPolishBindings(): void {
  const proto = MusicAssistantDashboardCard.prototype as unknown as CardPrototype;
  if (proto.__polishBindingsInstalled) return;
  proto.__polishBindingsInstalled = true;

  const originalRenderArtwork = proto.renderArtwork as (this: PolishCard, item: MediaItem) => TemplateResult;
  const originalRenderMainView = proto.renderMainView as (this: PolishCard) => TemplateResult;
  const originalRenderQueue = proto.renderQueue as (this: PolishCard) => TemplateResult;

  proto.renderArtwork = function renderArtwork(this: PolishCard, item: MediaItem): TemplateResult {
    if (!isBridgeCard(this) || item.imageUrl) return originalRenderArtwork.call(this, item);
    requestMissingArtwork(this, item);
    const imageUrl = resolvedArtwork(this, item);
    return originalRenderArtwork.call(this, imageUrl ? { ...item, imageUrl } : item);
  };

  proto.renderMainView = function renderMainView(this: PolishCard): TemplateResult {
    const view = originalRenderMainView.call(this);
    if (!isBridgeCard(this) || this.section === "listen") return view;
    return html`${miniPlayer(this)}${view}`;
  };

  proto.renderQueue = function renderQueue(this: PolishCard): TemplateResult {
    const queue = originalRenderQueue.call(this);
    return html`
      ${queue}
      <style>
        @media (max-width:650px){
          .queue-panel{width:100vw;max-width:none;padding:18px 12px calc(18px + env(safe-area-inset-bottom));}
          .queue-header{padding:0 4px 14px}.queue-header h3{font-size:20px}.queue-header .text-button{min-height:40px;padding:0 10px}
          .close-queue{width:42px;height:42px}
          .queue-list{padding-top:12px}.queue-now{padding:10px 0 13px}
          .queue-item{height:auto;min-height:70px;grid-template-columns:52px minmax(0,1fr) auto;gap:11px;padding:8px 5px;margin-bottom:4px;border-radius:13px}
          .queue-art{width:52px;height:52px;border-radius:10px}.queue-copy{min-height:48px;display:flex;flex-direction:column;justify-content:center}
          .queue-copy strong{font-size:12px}.queue-copy span{font-size:10px;margin-top:4px}.duration{font-size:9px;padding-right:4px}
          .queue-tools{display:flex!important;position:static;grid-column:2 / 4;justify-self:stretch;background:transparent;border:0;box-shadow:none;border-radius:0;gap:6px;margin-top:1px}
          .queue-tools button{flex:1;min-width:44px;height:40px;border:1px solid var(--line)!important;border-radius:9px;background:rgba(255,255,255,.035);font-size:17px}
          .queue-footer{gap:8px;padding-top:10px}.queue-footer button{height:46px;font-size:10px}
        }
      </style>
    `;
  };
}
