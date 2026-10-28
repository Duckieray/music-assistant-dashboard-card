import { html, nothing, type TemplateResult } from "lit";
import { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";
import type { DashboardConfig, MediaItem } from "./types";

const BRIDGE_ADDRESS = "ha-music-assistant-dashboard-bridge";
const SEARCH_DEBOUNCE_MS = 320;

type BridgeHass = {
  callWS<T>(message: Record<string, unknown>): Promise<T>;
};

type RawImage = {
  path?: string;
  proxy_id?: string | null;
  remotely_accessible?: boolean;
};

type RawMediaItem = {
  item_id?: string | number;
  provider?: string;
  uri?: string;
  name?: string;
  media_type?: string;
  favorite?: boolean;
  owner?: string;
  artists?: RawMediaItem[];
  album?: RawMediaItem | null;
  image?: RawImage | string | null;
  metadata?: {
    images?: RawImage[];
  } | null;
};

type RawSearchResults = {
  artists?: RawMediaItem[];
  albums?: RawMediaItem[];
  tracks?: RawMediaItem[];
  playlists?: RawMediaItem[];
  radio?: RawMediaItem[];
  radios?: RawMediaItem[];
};

type MediaState = {
  loading: boolean;
  loaded: boolean;
  attempted: boolean;
  error?: string;
  baseUrl?: string;
  albums: MediaItem[];
  artists: MediaItem[];
  tracks: MediaItem[];
  playlists: MediaItem[];
  radios: MediaItem[];
  recent: MediaItem[];
  searchResults: MediaItem[];
  searchLoading: boolean;
  searchError?: string;
  searchTerm: string;
  searchTimer?: ReturnType<typeof setTimeout>;
};

type MediaCard = {
  hass?: BridgeHass;
  config?: DashboardConfig;
  liveMode?: boolean;
  liveQueueId?: string;
  playerId: string;
  searchText: string;
  requestUpdate(): void;
};

type RenderHelpers = {
  renderNowPlaying(): TemplateResult;
  renderShelf(title: string, subtitle: string, items: MediaItem[]): TemplateResult;
  renderArtwork(item: MediaItem): TemplateResult;
  playMedia(item: MediaItem): void;
};

type CardPrototype = Record<string, unknown>;

const mediaStates = new WeakMap<MediaCard, MediaState>();

function newState(): MediaState {
  return {
    loading: false,
    loaded: false,
    attempted: false,
    albums: [],
    artists: [],
    tracks: [],
    playlists: [],
    radios: [],
    recent: [],
    searchResults: [],
    searchLoading: false,
    searchTerm: ""
  };
}

function stateFor(card: MediaCard): MediaState {
  let state = mediaStates.get(card);
  if (!state) {
    state = newState();
    mediaStates.set(card, state);
  }
  return state;
}

function isBridgeCard(card: MediaCard): boolean {
  return card.liveMode === true
    && (card.config?.server_url === BRIDGE_ADDRESS || card.config?.url === BRIDGE_ADDRESS)
    && typeof card.hass?.callWS === "function";
}

function callBridge<T>(card: MediaCard, type: string, extra: Record<string, unknown> = {}): Promise<T> {
  if (!card.hass?.callWS) return Promise.reject(new Error("Home Assistant bridge is unavailable"));
  return card.hass.callWS<T>({ type: `music_assistant_dashboard/${type}`, ...extra });
}

function colors(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return [`hsl(${hue} 58% 48%)`, `hsl(${(hue + 54) % 360} 48% 24%)`];
}

function titleCase(value?: string): string {
  if (!value) return "Music Assistant";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function kindFor(item: RawMediaItem, fallback: MediaItem["kind"]): MediaItem["kind"] {
  const type = item.media_type;
  if (type === "artist" || type === "album" || type === "track" || type === "playlist" || type === "radio") return type;
  return fallback;
}

function imageUrl(item: RawMediaItem, baseUrl?: string): string | undefined {
  const image = item.image ?? item.metadata?.images?.[0];
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (image.proxy_id && baseUrl) return `${baseUrl}/imageproxy/${image.proxy_id}?size=640`;
  if (image.path?.startsWith("http://") || image.path?.startsWith("https://")) return image.path;
  if (image.remotely_accessible && image.path) return image.path;
  return undefined;
}

function subtitleFor(item: RawMediaItem, kind: MediaItem["kind"]): string {
  const artists = item.artists?.map((artist) => artist.name).filter(Boolean).join(", ");
  if (kind === "track") {
    return artists || item.album?.name || "Track";
  }
  if (kind === "album") return artists || `${titleCase(item.provider)} album`;
  if (kind === "artist") return `${titleCase(item.provider)} artist`;
  if (kind === "playlist") return item.owner ? `${item.owner} • Playlist` : `${titleCase(item.provider)} playlist`;
  return `${titleCase(item.provider)} radio`;
}

function toMediaItem(item: RawMediaItem, fallback: MediaItem["kind"], baseUrl?: string): MediaItem {
  const kind = kindFor(item, fallback);
  const uri = item.uri;
  const seed = uri || `${item.provider ?? "mass"}:${item.media_type ?? fallback}:${item.item_id ?? item.name ?? "item"}`;
  const [accent, secondary] = colors(seed);
  return {
    id: seed,
    title: item.name || "Untitled",
    subtitle: subtitleFor(item, kind),
    kind,
    accent,
    secondary,
    uri,
    mediaType: item.media_type || kind,
    imageUrl: imageUrl(item, baseUrl),
    favorite: item.favorite
  };
}

function dedupe(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.uri || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadCatalog(card: MediaCard): Promise<void> {
  if (!isBridgeCard(card)) return;
  const state = stateFor(card);
  if (state.loading || state.loaded || state.attempted) return;
  state.loading = true;
  state.attempted = true;
  state.error = undefined;
  card.requestUpdate();

  try {
    const infoPromise = callBridge<{ base_url?: string | null }>(card, "info");
    const recentPromise = callBridge<RawMediaItem[]>(card, "recently_played", { limit: 12 }).catch(() => []);
    const [info, albums, artists, tracks, playlists, radios, recent] = await Promise.all([
      infoPromise,
      callBridge<RawMediaItem[]>(card, "library", { media_type: "album", limit: 30, offset: 0 }),
      callBridge<RawMediaItem[]>(card, "library", { media_type: "artist", limit: 30, offset: 0 }),
      callBridge<RawMediaItem[]>(card, "library", { media_type: "track", limit: 40, offset: 0 }),
      callBridge<RawMediaItem[]>(card, "library", { media_type: "playlist", limit: 40, offset: 0 }),
      callBridge<RawMediaItem[]>(card, "library", { media_type: "radio", limit: 30, offset: 0 }),
      recentPromise
    ]);

    state.baseUrl = info.base_url?.replace(/\/$/, "") || undefined;
    state.albums = albums.map((item) => toMediaItem(item, "album", state.baseUrl));
    state.artists = artists.map((item) => toMediaItem(item, "artist", state.baseUrl));
    state.tracks = tracks.map((item) => toMediaItem(item, "track", state.baseUrl));
    state.playlists = playlists.map((item) => toMediaItem(item, "playlist", state.baseUrl));
    state.radios = radios.map((item) => toMediaItem(item, "radio", state.baseUrl));
    state.recent = recent.map((item) => toMediaItem(item, kindFor(item, "track"), state.baseUrl));
    state.loaded = true;
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
  } finally {
    state.loading = false;
    card.requestUpdate();
  }
}

async function playLiveMedia(card: MediaCard, item: MediaItem): Promise<void> {
  if (!isBridgeCard(card) || !item.uri) return;
  const queueId = card.liveQueueId || card.playerId;
  if (!queueId) return;
  try {
    await callBridge(card, "command", {
      action: "play_media",
      args: {
        queue_id: queueId,
        media: item.uri,
        option: "replace"
      }
    });
    const state = stateFor(card);
    state.error = undefined;
  } catch (error) {
    stateFor(card).error = error instanceof Error ? error.message : String(error);
  }
  card.requestUpdate();
}

function flattenSearch(result: RawSearchResults, baseUrl?: string): MediaItem[] {
  return dedupe([
    ...(result.tracks ?? []).map((item) => toMediaItem(item, "track", baseUrl)),
    ...(result.albums ?? []).map((item) => toMediaItem(item, "album", baseUrl)),
    ...(result.artists ?? []).map((item) => toMediaItem(item, "artist", baseUrl)),
    ...(result.playlists ?? []).map((item) => toMediaItem(item, "playlist", baseUrl)),
    ...(result.radio ?? result.radios ?? []).map((item) => toMediaItem(item, "radio", baseUrl))
  ]);
}

function scheduleSearch(card: MediaCard): void {
  const state = stateFor(card);
  const term = card.searchText.trim();
  state.searchTerm = term;
  state.searchError = undefined;
  if (state.searchTimer) clearTimeout(state.searchTimer);
  if (!term) {
    state.searchResults = [];
    state.searchLoading = false;
    card.requestUpdate();
    return;
  }

  state.searchLoading = true;
  card.requestUpdate();
  state.searchTimer = setTimeout(() => {
    state.searchTimer = undefined;
    const requested = term;
    void callBridge<RawSearchResults>(card, "search", { query: requested, limit: 12 })
      .then((result) => {
        if (state.searchTerm !== requested) return;
        state.searchResults = flattenSearch(result, state.baseUrl);
        state.searchError = undefined;
      })
      .catch((error: unknown) => {
        if (state.searchTerm !== requested) return;
        state.searchResults = [];
        state.searchError = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        if (state.searchTerm === requested) state.searchLoading = false;
        card.requestUpdate();
      });
  }, SEARCH_DEBOUNCE_MS);
}

function renderStatus(title: string, message: string): TemplateResult {
  return html`
    <section class="shelf">
      <div class="section-title"><div><h3>${title}</h3><p>${message}</p></div></div>
    </section>
  `;
}

function renderShelf(card: MediaCard, title: string, subtitle: string, items: MediaItem[]): TemplateResult {
  return (card as unknown as RenderHelpers).renderShelf(title, subtitle, items);
}

function renderNowPlaying(card: MediaCard): TemplateResult {
  return (card as unknown as RenderHelpers).renderNowPlaying();
}

function mediaArtStyle(item: MediaItem): string {
  const base = `--a:${item.accent};--b:${item.secondary};`;
  if (!item.imageUrl) return base;
  const safe = item.imageUrl.replace(/["')]/g, encodeURIComponent);
  return `${base}background-image:linear-gradient(rgba(0,0,0,.04),rgba(0,0,0,.04)),url("${safe}");background-size:cover;background-position:center;`;
}

function mediaSymbol(item: MediaItem): string {
  if (item.kind === "radio") return "◉";
  if (item.kind === "playlist") return "≡";
  if (item.kind === "artist") return "♪";
  return "▶";
}

export function installLiveMediaBindings(): void {
  const proto = MusicAssistantDashboardCard.prototype as unknown as CardPrototype;
  if (proto.__liveMediaBindingsInstalled) return;
  proto.__liveMediaBindingsInstalled = true;

  const originalRenderArtwork = proto.renderArtwork as (this: MediaCard, item: MediaItem) => TemplateResult;
  const originalRenderListen = proto.renderListen as (this: MediaCard) => TemplateResult;
  const originalRenderLibrary = proto.renderLibrary as (this: MediaCard) => TemplateResult;
  const originalRenderPlaylists = proto.renderPlaylists as (this: MediaCard) => TemplateResult;
  const originalRenderRadio = proto.renderRadio as (this: MediaCard) => TemplateResult;
  const originalRenderSearch = proto.renderSearch as (this: MediaCard) => TemplateResult;
  const originalPlayMedia = proto.playMedia as (this: MediaCard, item: MediaItem) => void;
  const originalDisconnected = proto.disconnectedCallback as ((this: MediaCard) => void) | undefined;

  proto.disconnectedCallback = function disconnectedCallback(this: MediaCard): void {
    const state = mediaStates.get(this);
    if (state?.searchTimer) clearTimeout(state.searchTimer);
    mediaStates.delete(this);
    originalDisconnected?.call(this);
  };

  proto.playMedia = function playMedia(this: MediaCard, item: MediaItem): void {
    if (!isBridgeCard(this)) return originalPlayMedia.call(this, item);
    void playLiveMedia(this, item);
  };

  proto.renderArtwork = function renderArtwork(this: MediaCard, item: MediaItem): TemplateResult {
    if (!isBridgeCard(this)) return originalRenderArtwork.call(this, item);
    return html`
      <button class="media-card" @click=${() => { void playLiveMedia(this, item); }} title=${item.uri ? `Play ${item.title}` : item.title}>
        <div class="art media-art" style=${mediaArtStyle(item)}>
          ${item.imageUrl ? nothing : html`<div class="media-symbol">${mediaSymbol(item)}</div>`}
          ${item.uri ? html`<div class="hover-play">▶</div>` : nothing}
        </div>
        <strong>${item.title}</strong>
        <span>${item.subtitle}</span>
      </button>
    `;
  };

  proto.renderListen = function renderListen(this: MediaCard): TemplateResult {
    if (!isBridgeCard(this)) return originalRenderListen.call(this);
    const state = stateFor(this);
    void loadCatalog(this);
    if (state.loading && !state.loaded) {
      return html`${renderNowPlaying(this)}${renderStatus("Loading your music", "Fetching your Music Assistant library…")}`;
    }
    if (state.error && !state.loaded) {
      return html`${renderNowPlaying(this)}${renderStatus("Music library unavailable", state.error)}`;
    }
    return html`
      ${renderNowPlaying(this)}
      ${renderShelf(this, "Recently Played", "From your Music Assistant history", state.recent.slice(0, 10))}
      ${renderShelf(this, "Your Playlists", "From your Music Assistant library", state.playlists.slice(0, 10))}
      ${renderShelf(this, "Radio", "Stations in your Music Assistant library", state.radios.slice(0, 10))}
    `;
  };

  proto.renderLibrary = function renderLibrary(this: MediaCard): TemplateResult {
    if (!isBridgeCard(this)) return originalRenderLibrary.call(this);
    const state = stateFor(this);
    void loadCatalog(this);
    if (state.loading && !state.loaded) return renderStatus("Your Library", "Loading from Music Assistant…");
    if (state.error && !state.loaded) return renderStatus("Your Library", state.error);
    return html`
      <div class="filter-bar">
        <button class="pill active">All</button><button class="pill">Albums</button><button class="pill">Artists</button><button class="pill">Songs</button>
      </div>
      ${renderShelf(this, "Albums", `${state.albums.length} loaded from Music Assistant`, state.albums.slice(0, 12))}
      ${renderShelf(this, "Artists", `${state.artists.length} loaded from Music Assistant`, state.artists.slice(0, 12))}
      ${renderShelf(this, "Songs", `${state.tracks.length} loaded from Music Assistant`, state.tracks.slice(0, 12))}
    `;
  };

  proto.renderPlaylists = function renderPlaylists(this: MediaCard): TemplateResult {
    if (!isBridgeCard(this)) return originalRenderPlaylists.call(this);
    const state = stateFor(this);
    void loadCatalog(this);
    if (state.loading && !state.loaded) return renderStatus("Playlists", "Loading from Music Assistant…");
    if (state.error && !state.loaded) return renderStatus("Playlists", state.error);
    if (!state.playlists.length) return renderStatus("Playlists", "No playlists are currently in your Music Assistant library.");
    return renderShelf(this, "Playlists", `${state.playlists.length} playlists from your connected providers`, state.playlists);
  };

  proto.renderRadio = function renderRadio(this: MediaCard): TemplateResult {
    if (!isBridgeCard(this)) return originalRenderRadio.call(this);
    const state = stateFor(this);
    void loadCatalog(this);
    const first = state.radios[0];
    return html`
      <section class="radio-hero surface">
        <div><span class="eyebrow">MUSIC ASSISTANT RADIO</span><h2>Start a station from your library.</h2><p>These are the radio stations currently available through Music Assistant.</p><button class="primary-action" ?disabled=${!first} @click=${() => { if (first) void playLiveMedia(this, first); }}>▶ Start a station</button></div>
        <div class="radio-orb">◉</div>
      </section>
      ${state.loading && !state.loaded
        ? renderStatus("Your Stations", "Loading from Music Assistant…")
        : state.error && !state.loaded
          ? renderStatus("Your Stations", state.error)
          : state.radios.length
            ? renderShelf(this, "Your Stations", `${state.radios.length} stations in your library`, state.radios)
            : renderStatus("Your Stations", "No radio stations are currently in your Music Assistant library.")}
    `;
  };

  proto.renderSearch = function renderSearch(this: MediaCard): TemplateResult {
    if (!isBridgeCard(this)) return originalRenderSearch.call(this);
    const state = stateFor(this);
    void loadCatalog(this);
    const term = this.searchText.trim();
    const browse = dedupe([...state.recent, ...state.playlists, ...state.albums, ...state.artists, ...state.radios]).slice(0, 12);
    return html`
      <div class="search-box">⌕<input autofocus placeholder="Search Music Assistant and connected providers" .value=${this.searchText} @input=${(event: Event) => {
        this.searchText = (event.target as HTMLInputElement).value;
        scheduleSearch(this);
      }} /></div>
      ${state.searchLoading
        ? renderStatus(`Searching for “${this.searchText}”`, "Searching Music Assistant and your connected providers…")
        : state.searchError
          ? renderStatus("Search failed", state.searchError)
          : term
            ? state.searchResults.length
              ? renderShelf(this, `Results for “${this.searchText}”`, `${state.searchResults.length} matches`, state.searchResults)
              : renderStatus(`Results for “${this.searchText}”`, "No matches found.")
            : renderShelf(this, "Browse", "Recent music and items from your library", browse)}
    `;
  };
}
