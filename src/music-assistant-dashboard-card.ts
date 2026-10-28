import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { demoPlayers, demoQueue, playlists, radioItems, recentlyPlayed } from "./demo-data";
import type { DashboardConfig, HomeAssistantLike, MediaItem, NavSection, Player, Track } from "./types";

const icons: Record<string, string> = {
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
  const path = icons[name] ?? icons.more;
  if (name === "chevron" || name === "close") {
    return html`<svg viewBox="0 0 24 24" width=${size} height=${size} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d=${path}></path></svg>`;
  }
  return html`<svg viewBox="0 0 24 24" width=${size} height=${size} fill="currentColor" aria-hidden="true"><path d=${path}></path></svg>`;
}

export class MusicAssistantDashboardCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
    section: { state: true },
    playing: { state: true },
    shuffled: { state: true },
    repeatMode: { state: true },
    favorite: { state: true },
    volume: { state: true },
    progress: { state: true },
    playerId: { state: true },
    queue: { state: true },
    groupOpen: { state: true },
    mobileQueueOpen: { state: true },
    searchText: { state: true }
  };

  hass?: HomeAssistantLike;
  config?: DashboardConfig;
  private section: NavSection = "listen";
  private playing = true;
  private shuffled = false;
  private repeatMode: 0 | 1 | 2 = 0;
  private favorite = false;
  private volume = 46;
  private progress = 38;
  private playerId = "pool-room";
  private queue: Track[] = [...demoQueue];
  private groupOpen = false;
  private mobileQueueOpen = false;
  private searchText = "";

  setConfig(config: DashboardConfig): void {
    if (!config) throw new Error("Music Assistant Dashboard requires configuration.");
    this.config = config;
    if (config.default_player) this.playerId = config.default_player;
  }

  getCardSize(): number {
    return 12;
  }

  private get currentPlayer(): Player {
    return demoPlayers.find((player) => player.id === this.playerId) ?? demoPlayers[0];
  }

  private get currentTrack(): Track {
    return this.queue[0] ?? demoQueue[0];
  }

  private navigate(section: NavSection): void {
    this.section = section;
  }

  private cycleRepeat(): void {
    this.repeatMode = ((this.repeatMode + 1) % 3) as 0 | 1 | 2;
  }

  private moveTrack(index: number, delta: number): void {
    const target = index + delta;
    if (target < 1 || target >= this.queue.length || index < 1) return;
    const next = [...this.queue];
    [next[index], next[target]] = [next[target], next[index]];
    this.queue = next;
  }

  private removeTrack(index: number): void {
    if (index === 0) return;
    this.queue = this.queue.filter((_, itemIndex) => itemIndex !== index);
  }

  private selectTrack(index: number): void {
    if (index <= 0 || index >= this.queue.length) return;
    const next = [...this.queue];
    const [selected] = next.splice(index, 1);
    this.queue = [selected, ...next];
    this.progress = 0;
    this.playing = true;
  }

  private playMedia(item: MediaItem): void {
    const synthetic: Track = {
      id: `media-${item.id}`,
      title: item.title,
      artist: item.subtitle,
      album: item.kind === "radio" ? "Radio" : "Music Assistant",
      duration: item.kind === "radio" ? "LIVE" : "3:48",
      accent: item.accent,
      secondary: item.secondary
    };
    this.queue = [synthetic, ...this.queue.filter((track) => track.id !== synthetic.id)];
    this.progress = 0;
    this.playing = true;
  }

  private renderSidebar(): TemplateResult {
    const nav: Array<[NavSection, string, string]> = [
      ["listen", "home", "Listen Now"],
      ["library", "library", "Library"],
      ["playlists", "playlist", "Playlists"],
      ["radio", "radio", "Radio"],
      ["search", "search", "Search"]
    ];
    return html`
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">${icon("play", 18)}</div>
          <div><strong>Music</strong><span>Assistant</span></div>
        </div>
        <nav>
          ${nav.map(([section, iconName, label]) => html`
            <button class=${this.section === section ? "nav active" : "nav"} @click=${() => this.navigate(section)}>
              ${icon(iconName, 19)}<span>${label}</span>
            </button>
          `)}
        </nav>
        <div class="sidebar-spacer"></div>
        <div class="sidebar-card">
          <span class="eyebrow">ACTIVE SYSTEM</span>
          <strong>Music Assistant</strong>
          <span><i></i> Connected</span>
        </div>
      </aside>
    `;
  }

  private renderTopbar(): TemplateResult {
    return html`
      <header class="topbar">
        <div>
          <span class="eyebrow">${this.section === "listen" ? "GOOD EVENING" : this.section.toUpperCase()}</span>
          <h1>${this.section === "listen" ? "Listen Now" : this.section === "radio" ? "Radio" : this.section[0].toUpperCase() + this.section.slice(1)}</h1>
        </div>
        <div class="top-actions">
          <button class="room-picker" @click=${() => (this.groupOpen = true)}>
            <span class="room-icon">${icon("speakers", 18)}</span>
            <span><small>Playing in</small><strong>${this.currentPlayer.name}</strong></span>
            ${icon("chevron", 17)}
          </button>
          <button class="icon-button mobile-queue" title="Queue" @click=${() => (this.mobileQueueOpen = true)}>${icon("queue", 20)}</button>
          <button class="avatar">DR</button>
        </div>
      </header>
    `;
  }

  private renderNowPlaying(): TemplateResult {
    const track = this.currentTrack;
    return html`
      <section class="now-playing surface">
        <div class="art hero-art" style=${`--a:${track.accent};--b:${track.secondary}`}>
          <div class="vinyl-ring"></div>
          <div class="art-label"><small>NOW PLAYING</small><b>${track.artist.split(" ")[0]}</b></div>
        </div>
        <div class="track-panel">
          <div class="track-heading">
            <div>
              <span class="eyebrow">NOW PLAYING</span>
              <h2>${track.title}</h2>
              <p>${track.artist} <span>•</span> ${track.album}</p>
            </div>
            <button class=${this.favorite ? "icon-button favorite active" : "icon-button favorite"} @click=${() => (this.favorite = !this.favorite)}>${icon("heart", 20)}</button>
          </div>
          <div class="progress-wrap">
            <input aria-label="Track progress" type="range" min="0" max="100" .value=${String(this.progress)} @input=${(e: Event) => (this.progress = Number((e.target as HTMLInputElement).value))} />
            <div class="time-row"><span>1:32</span><span>${track.duration === "LIVE" ? "LIVE" : `-${track.duration}`}</span></div>
          </div>
          <div class="transport">
            <button class=${this.shuffled ? "transport-small active" : "transport-small"} title="Shuffle" @click=${() => (this.shuffled = !this.shuffled)}>${icon("shuffle", 19)}</button>
            <button class="transport-small" title="Previous">${icon("prev", 22)}</button>
            <button class="play-button" title=${this.playing ? "Pause" : "Play"} @click=${() => (this.playing = !this.playing)}>${icon(this.playing ? "pause" : "play", 27)}</button>
            <button class="transport-small" title="Next" @click=${() => this.selectTrack(1)}>${icon("next", 22)}</button>
            <button class=${this.repeatMode ? "transport-small active repeat" : "transport-small repeat"} title="Repeat" @click=${this.cycleRepeat}>${icon("repeat", 19)}${this.repeatMode === 2 ? html`<em>1</em>` : nothing}</button>
          </div>
          <div class="volume-row">
            ${icon("volume", 19)}
            <input aria-label="Volume" type="range" min="0" max="100" .value=${String(this.volume)} @input=${(e: Event) => (this.volume = Number((e.target as HTMLInputElement).value))} />
            <span>${this.volume}%</span>
          </div>
        </div>
      </section>
    `;
  }

  private renderArtwork(item: MediaItem): TemplateResult {
    return html`
      <button class="media-card" @click=${() => this.playMedia(item)} title=${`Play ${item.title}`}>
        <div class="art media-art" style=${`--a:${item.accent};--b:${item.secondary}`}>
          <div class="media-symbol">${item.kind === "radio" ? icon("radio", 27) : item.kind === "playlist" ? icon("playlist", 27) : icon("play", 27)}</div>
          <div class="hover-play">${icon("play", 22)}</div>
        </div>
        <strong>${item.title}</strong>
        <span>${item.subtitle}</span>
      </button>
    `;
  }

  private renderShelf(title: string, subtitle: string, items: MediaItem[]): TemplateResult {
    return html`
      <section class="shelf">
        <div class="section-title"><div><h3>${title}</h3><p>${subtitle}</p></div><button>See all</button></div>
        <div class="media-grid">${items.map((item) => this.renderArtwork(item))}</div>
      </section>
    `;
  }

  private renderListen(): TemplateResult {
    return html`
      ${this.renderNowPlaying()}
      ${this.renderShelf("Recently Played", "Jump back in", recentlyPlayed)}
      ${this.renderShelf("Your Playlists", "From your Music Assistant library", playlists)}
      ${this.renderShelf("Radio & Endless Mixes", "Keep the music going", radioItems)}
    `;
  }

  private renderLibrary(): TemplateResult {
    const combined = [...recentlyPlayed, ...playlists, ...radioItems].slice(0, 10);
    return html`
      <div class="filter-bar">
        <button class="pill active">All</button><button class="pill">Albums</button><button class="pill">Artists</button><button class="pill">Songs</button><button class="pill">Favorites</button>
      </div>
      ${this.renderShelf("Your Library", "Music available through Music Assistant", combined)}
      ${this.renderShelf("Recently Added", "New to your library", [...playlists].reverse())}
    `;
  }

  private renderPlaylists(): TemplateResult {
    return html`${this.renderShelf("Playlists", "Apple Music and Music Assistant playlists", [...playlists, ...recentlyPlayed.filter((item) => item.kind === "playlist")])}`;
  }

  private renderRadio(): TemplateResult {
    return html`
      <section class="radio-hero surface">
        <div><span class="eyebrow">ENDLESS MUSIC</span><h2>Start a station from anything.</h2><p>Artist radio, provider stations, and Music Assistant endless mixes live together in one place.</p><button class="primary-action" @click=${() => this.playMedia(radioItems[0])}>${icon("play", 18)} Start a station</button></div>
        <div class="radio-orb">${icon("radio", 48)}</div>
      </section>
      ${this.renderShelf("Your Stations", "Favorites and recently played", radioItems)}
      ${this.renderShelf("Made for the moment", "Continuous mixes from your library", [...radioItems].reverse())}
    `;
  }

  private renderSearch(): TemplateResult {
    const term = this.searchText.trim().toLowerCase();
    const all = [...recentlyPlayed, ...playlists, ...radioItems];
    const results = term ? all.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(term)) : all.slice(0, 5);
    return html`
      <div class="search-box">${icon("search", 22)}<input autofocus placeholder="Search Apple Music and your library" .value=${this.searchText} @input=${(e: Event) => (this.searchText = (e.target as HTMLInputElement).value)} /></div>
      ${this.renderShelf(term ? `Results for “${this.searchText}”` : "Browse", term ? `${results.length} matches in this prototype` : "Try an artist, album, song, or playlist", results)}
    `;
  }

  private renderMainView(): TemplateResult {
    switch (this.section) {
      case "library": return this.renderLibrary();
      case "playlists": return this.renderPlaylists();
      case "radio": return this.renderRadio();
      case "search": return this.renderSearch();
      default: return this.renderListen();
    }
  }

  private renderQueue(): TemplateResult {
    return html`
      <aside class="queue-panel ${this.mobileQueueOpen ? "open" : ""}">
        <div class="queue-header">
          <div><span class="eyebrow">${this.queue.length} ITEMS</span><h3>Up Next</h3></div>
          <div class="queue-header-actions">
            <button class="text-button" @click=${() => (this.queue = this.queue.slice(0, 1))}>Clear</button>
            <button class="icon-button close-queue" @click=${() => (this.mobileQueueOpen = false)}>${icon("close", 19)}</button>
          </div>
        </div>
        <div class="queue-now">
          <span>PLAYING NOW</span>
          ${this.renderQueueItem(this.currentTrack, 0)}
        </div>
        <div class="queue-list">
          <span class="queue-label">NEXT</span>
          ${this.queue.slice(1).map((track, localIndex) => this.renderQueueItem(track, localIndex + 1))}
        </div>
        <div class="queue-footer">
          <button>${icon("shuffle", 17)} Shuffle remaining</button>
          <button>${icon("more", 17)} Queue actions</button>
        </div>
      </aside>
    `;
  }

  private renderQueueItem(track: Track, index: number): TemplateResult {
    return html`
      <div class=${index === 0 ? "queue-item current" : "queue-item"}>
        <button class="queue-art art" style=${`--a:${track.accent};--b:${track.secondary}`} @click=${() => this.selectTrack(index)}>${index === 0 && this.playing ? html`<span class="bars"><i></i><i></i><i></i></span>` : icon("play", 14)}</button>
        <button class="queue-copy" @click=${() => this.selectTrack(index)}><strong>${track.title}</strong><span>${track.artist}</span></button>
        <span class="duration">${track.duration}</span>
        ${index > 0 ? html`
          <div class="queue-tools">
            <button title="Move up" @click=${() => this.moveTrack(index, -1)}>↑</button>
            <button title="Move down" @click=${() => this.moveTrack(index, 1)}>↓</button>
            <button title="Remove" @click=${() => this.removeTrack(index)}>×</button>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private renderGroupDialog(): TemplateResult | typeof nothing {
    if (!this.groupOpen) return nothing;
    return html`
      <div class="modal-backdrop" @click=${() => (this.groupOpen = false)}>
        <div class="group-dialog" @click=${(event: Event) => event.stopPropagation()}>
          <div class="dialog-title"><div><span class="eyebrow">MULTI-ROOM AUDIO</span><h3>Playing in</h3></div><button class="icon-button" @click=${() => (this.groupOpen = false)}>${icon("close", 20)}</button></div>
          <div class="room-list">
            ${demoPlayers.map((player) => html`
              <div class=${player.id === this.playerId ? "room-row selected" : "room-row"}>
                <button class="check" @click=${() => (this.playerId = player.id)}>${player.grouped || player.id === this.playerId ? "✓" : ""}</button>
                <button class="room-copy" @click=${() => (this.playerId = player.id)}><strong>${player.name}</strong><span>${player.id === this.playerId ? "Primary player" : player.grouped ? "Grouped" : "Available"}</span></button>
                <input type="range" min="0" max="100" .value=${String(player.id === this.playerId ? this.volume : player.volume)} />
                <span>${player.id === this.playerId ? this.volume : player.volume}%</span>
              </div>
            `)}
          </div>
          <div class="dialog-actions"><button class="secondary-action">Transfer playback</button><button class="primary-action" @click=${() => (this.groupOpen = false)}>Update group</button></div>
        </div>
      </div>
    `;
  }

  private renderMobileNav(): TemplateResult {
    const nav: Array<[NavSection, string, string]> = [["listen", "home", "Listen"], ["library", "library", "Library"], ["playlists", "playlist", "Playlists"], ["radio", "radio", "Radio"], ["search", "search", "Search"]];
    return html`<nav class="mobile-nav">${nav.map(([section, iconName, label]) => html`<button class=${this.section === section ? "active" : ""} @click=${() => this.navigate(section)}>${icon(iconName, 20)}<span>${label}</span></button>`)}</nav>`;
  }

  render(): TemplateResult {
    return html`
      <div class="dashboard-shell">
        ${this.renderSidebar()}
        <main class="main-column">
          ${this.renderTopbar()}
          <div class="content">${this.renderMainView()}</div>
        </main>
        ${this.renderQueue()}
        ${this.renderMobileNav()}
        ${this.renderGroupDialog()}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      --bg: #0b0d12;
      --sidebar: #0f1219;
      --panel: #151922;
      --panel-2: #191e29;
      --panel-3: #202633;
      --line: rgba(255,255,255,.075);
      --text: #f7f8fb;
      --muted: #8f98aa;
      --soft: #c6ccda;
      --accent: #8e7dff;
      --accent-2: #d26fdd;
      --green: #65d99d;
      color: var(--text);
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    button, input { font: inherit; }
    button { color: inherit; }
    .dashboard-shell { min-height: 760px; height: min(880px, calc(100vh - 32px)); display: grid; grid-template-columns: 205px minmax(0,1fr) 340px; overflow: hidden; border: 1px solid var(--line); border-radius: 22px; background: radial-gradient(circle at 50% -10%, rgba(104,91,255,.11), transparent 30%), var(--bg); box-shadow: 0 24px 80px rgba(0,0,0,.28); }
    .sidebar { padding: 26px 18px 20px; background: rgba(15,18,25,.88); border-right: 1px solid var(--line); display: flex; flex-direction: column; min-width: 0; }
    .brand { display:flex; align-items:center; gap:11px; padding:0 8px 28px; }
    .brand-mark { width:34px; height:34px; display:grid; place-items:center; border-radius:11px; background: linear-gradient(145deg,var(--accent),var(--accent-2)); box-shadow:0 8px 24px rgba(142,125,255,.25); }
    .brand strong,.brand span{display:block}.brand strong{font-size:14px}.brand span{font-size:11px;color:var(--muted);margin-top:1px}
    nav { display:flex; flex-direction:column; gap:5px; }
    .nav { height:42px; border:0; border-radius:11px; display:flex; align-items:center; gap:12px; padding:0 12px; color:var(--muted); background:transparent; cursor:pointer; text-align:left; transition:.16s ease; }
    .nav:hover { color:var(--text); background:rgba(255,255,255,.045); transform: translateX(2px); }
    .nav.active { color:#fff; background:linear-gradient(90deg,rgba(142,125,255,.22),rgba(142,125,255,.08)); box-shadow:inset 2px 0 var(--accent); }
    .nav span { font-size:13px; font-weight:650; }
    .sidebar-spacer { flex:1; }
    .sidebar-card { padding:13px; border:1px solid var(--line); background:rgba(255,255,255,.025); border-radius:13px; display:flex; flex-direction:column; gap:5px; }
    .sidebar-card strong{font-size:12px}.sidebar-card>span:last-child{font-size:10px;color:var(--muted)}.sidebar-card i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);margin-right:5px;box-shadow:0 0 9px var(--green)}
    .eyebrow { font-size:9px; letter-spacing:.16em; color:var(--muted); font-weight:800; }
    .main-column { min-width:0; overflow:auto; scrollbar-width:thin; scrollbar-color:var(--panel-3) transparent; }
    .topbar { position:sticky; top:0; z-index:8; height:88px; padding:18px 24px 15px; display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to bottom,rgba(11,13,18,.98) 72%,rgba(11,13,18,0)); backdrop-filter:blur(12px); }
    .topbar h1 { font-size:23px; line-height:1; margin:6px 0 0; letter-spacing:-.025em; }
    .top-actions { display:flex; align-items:center; gap:9px; }
    .room-picker { height:47px; border:1px solid var(--line); border-radius:14px; background:rgba(255,255,255,.035); display:flex; align-items:center; gap:9px; padding:5px 10px 5px 6px; cursor:pointer; }
    .room-picker:hover{background:rgba(255,255,255,.06)}.room-icon{width:35px;height:35px;border-radius:10px;background:var(--panel-3);display:grid;place-items:center}.room-picker>span:nth-child(2){text-align:left;min-width:86px}.room-picker small,.room-picker strong{display:block}.room-picker small{font-size:9px;color:var(--muted);margin-bottom:2px}.room-picker strong{font-size:11px}
    .avatar { width:37px; height:37px; border:0; border-radius:50%; background:linear-gradient(145deg,#3b4354,#202633); color:#dbe0ea; font-size:10px; font-weight:800; cursor:pointer; }
    .icon-button { width:36px;height:36px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.035);display:grid;place-items:center;cursor:pointer;padding:0}.icon-button:hover{background:rgba(255,255,255,.08)}
    .mobile-queue,.close-queue{display:none}
    .content { padding: 2px 24px 56px; }
    .surface { border:1px solid var(--line); background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.022)); border-radius:18px; }
    .now-playing { min-height:272px; padding:18px; display:grid; grid-template-columns:236px minmax(0,1fr); gap:24px; position:relative; overflow:hidden; }
    .now-playing:after { content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 40%,color-mix(in srgb,var(--accent) 10%, transparent),transparent 33%);pointer-events:none; }
    .art { background: radial-gradient(circle at 72% 18%,rgba(255,255,255,.25),transparent 17%), linear-gradient(140deg,var(--a),var(--b)); position:relative; overflow:hidden; }
    .hero-art { border-radius:15px; min-height:234px; box-shadow:0 18px 38px rgba(0,0,0,.28); }
    .hero-art:before,.media-art:before{content:"";position:absolute;inset:-40%;background:conic-gradient(from 180deg,transparent,rgba(255,255,255,.17),transparent 28%);transform:rotate(20deg)}
    .vinyl-ring{position:absolute;width:150px;height:150px;border:22px solid rgba(10,11,20,.28);border-radius:50%;right:-38px;bottom:-35px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09),inset 0 0 0 9px rgba(255,255,255,.03)}
    .art-label{position:absolute;left:18px;bottom:17px;text-shadow:0 2px 12px rgba(0,0,0,.4)}.art-label small,.art-label b{display:block}.art-label small{font-size:8px;letter-spacing:.15em;font-weight:800;opacity:.75}.art-label b{font-size:24px;letter-spacing:-.05em;margin-top:3px}
    .track-panel { min-width:0; display:flex; flex-direction:column; justify-content:center; padding:8px 6px 5px 0; position:relative;z-index:1; }
    .track-heading { display:flex; justify-content:space-between; gap:15px; align-items:flex-start; }.track-heading h2{font-size:28px;line-height:1.08;letter-spacing:-.04em;margin:8px 0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.track-heading p{font-size:13px;color:var(--muted);margin:0}.track-heading p span{margin:0 4px;color:#5d6575}.favorite.active{color:#ff6f98;background:rgba(255,91,143,.12);border-color:rgba(255,91,143,.18)}
    .progress-wrap{margin-top:23px}.progress-wrap input,.volume-row input,.room-row input{width:100%;accent-color:var(--accent);height:3px;cursor:pointer}.time-row{display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:5px;font-variant-numeric:tabular-nums}
    .transport{display:flex;justify-content:center;align-items:center;gap:18px;margin-top:8px}.transport-small{width:33px;height:33px;border:0;background:transparent;color:var(--muted);display:grid;place-items:center;cursor:pointer;position:relative}.transport-small:hover,.transport-small.active{color:var(--text)}.transport-small.active{filter:drop-shadow(0 0 7px rgba(142,125,255,.55))}.repeat em{position:absolute;right:1px;bottom:1px;font-size:7px;font-style:normal;background:var(--accent);color:#fff;border-radius:6px;padding:0 3px}.play-button{width:50px;height:50px;border:0;border-radius:50%;background:#fff;color:#10131b;display:grid;place-items:center;cursor:pointer;box-shadow:0 9px 28px rgba(255,255,255,.12);transition:.15s}.play-button:hover{transform:scale(1.04)}
    .volume-row{display:grid;grid-template-columns:20px 1fr 35px;align-items:center;gap:8px;color:var(--muted);margin-top:9px}.volume-row span{font-size:9px;text-align:right;font-variant-numeric:tabular-nums}
    .shelf{margin-top:31px}.section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:13px}.section-title h3{font-size:16px;margin:0 0 4px;letter-spacing:-.02em}.section-title p{font-size:10px;color:var(--muted);margin:0}.section-title button,.text-button{border:0;background:transparent;color:#9f95ff;font-size:10px;font-weight:700;cursor:pointer}
    .media-grid{display:grid;grid-template-columns:repeat(5,minmax(112px,1fr));gap:13px}.media-card{border:0;background:transparent;padding:0;text-align:left;min-width:0;cursor:pointer}.media-art{aspect-ratio:1;border-radius:13px;margin-bottom:8px;box-shadow:0 10px 24px rgba(0,0,0,.17);transition:.18s ease}.media-card:hover .media-art{transform:translateY(-3px);box-shadow:0 15px 30px rgba(0,0,0,.25)}.media-symbol{position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.86);filter:drop-shadow(0 3px 12px rgba(0,0,0,.25))}.hover-play{position:absolute;right:8px;bottom:8px;width:35px;height:35px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#141721;opacity:0;transform:translateY(5px);transition:.15s;box-shadow:0 5px 18px rgba(0,0,0,.28)}.media-card:hover .hover-play{opacity:1;transform:none}.media-card strong,.media-card>span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.media-card strong{font-size:11px;margin:0 2px 3px}.media-card>span{font-size:9px;color:var(--muted);margin:0 2px}
    .filter-bar{display:flex;gap:8px;margin:3px 0 24px}.pill{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:7px 13px;font-size:10px;color:var(--muted);cursor:pointer}.pill.active{background:#fff;color:#151821;border-color:#fff}
    .radio-hero{min-height:205px;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;background:radial-gradient(circle at 85% 40%,rgba(225,72,164,.28),transparent 31%),linear-gradient(135deg,rgba(94,66,196,.22),rgba(255,255,255,.025));overflow:hidden}.radio-hero h2{font-size:27px;letter-spacing:-.04em;margin:7px 0 8px;max-width:420px}.radio-hero p{color:var(--muted);font-size:11px;line-height:1.55;max-width:470px}.primary-action,.secondary-action{height:37px;border-radius:11px;padding:0 15px;font-size:10px;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px}.primary-action{border:0;background:#fff;color:#131620}.secondary-action{border:1px solid var(--line);background:var(--panel-3);color:var(--soft)}.radio-orb{width:110px;height:110px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#e94396,#6b55f0);box-shadow:0 0 70px rgba(222,68,164,.3),inset 0 0 0 12px rgba(255,255,255,.07)}
    .search-box{height:58px;border:1px solid var(--line);border-radius:16px;background:var(--panel);display:flex;align-items:center;gap:12px;padding:0 17px;color:var(--muted);margin:4px 0 24px}.search-box:focus-within{border-color:rgba(142,125,255,.55);box-shadow:0 0 0 3px rgba(142,125,255,.08)}.search-box input{flex:1;background:transparent;border:0;outline:0;color:var(--text);font-size:14px}.search-box input::placeholder{color:#687183}
    .queue-panel{border-left:1px solid var(--line);background:rgba(15,18,25,.78);min-width:0;display:flex;flex-direction:column;padding:23px 17px 18px;overflow:hidden}.queue-header{display:flex;justify-content:space-between;align-items:center;padding:0 4px 17px}.queue-header h3{font-size:17px;margin:5px 0 0}.queue-header-actions{display:flex;align-items:center;gap:5px}.queue-now{padding:12px 0 16px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.queue-now>span,.queue-label{display:block;font-size:8px;letter-spacing:.14em;color:var(--muted);font-weight:800;margin:0 5px 7px}.queue-list{overflow:auto;flex:1;padding:15px 0 8px;scrollbar-width:thin;scrollbar-color:var(--panel-3) transparent}.queue-item{height:57px;display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:10px;padding:6px 5px;border-radius:11px;position:relative}.queue-item:hover{background:rgba(255,255,255,.035)}.queue-item.current{background:rgba(142,125,255,.07)}.queue-art{width:40px;height:40px;border:0;border-radius:8px;color:#fff;display:grid;place-items:center;cursor:pointer}.queue-copy{min-width:0;border:0;background:transparent;text-align:left;padding:0;cursor:pointer}.queue-copy strong,.queue-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.queue-copy strong{font-size:10px}.queue-copy span{font-size:9px;color:var(--muted);margin-top:3px}.duration{font-size:8px;color:#70798a;font-variant-numeric:tabular-nums}.queue-tools{display:none;position:absolute;right:3px;top:12px;background:var(--panel-3);border:1px solid var(--line);border-radius:8px;overflow:hidden;box-shadow:0 5px 18px rgba(0,0,0,.25)}.queue-item:hover .queue-tools{display:flex}.queue-tools button{width:27px;height:28px;border:0;border-right:1px solid var(--line);background:transparent;color:var(--soft);cursor:pointer}.queue-tools button:last-child{border-right:0}.bars{height:17px;display:flex;align-items:end;gap:2px}.bars i{display:block;width:2px;background:#fff;border-radius:2px;animation:eq .75s ease-in-out infinite alternate}.bars i:nth-child(1){height:7px}.bars i:nth-child(2){height:15px;animation-delay:-.3s}.bars i:nth-child(3){height:10px;animation-delay:-.55s}@keyframes eq{to{height:4px}}
    .queue-footer{border-top:1px solid var(--line);padding-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:7px}.queue-footer button{height:34px;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.025);color:var(--muted);font-size:9px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}.queue-footer button:hover{color:var(--text);background:rgba(255,255,255,.05)}
    .modal-backdrop{position:fixed;z-index:1000;inset:0;background:rgba(3,5,9,.68);backdrop-filter:blur(7px);display:grid;place-items:center;padding:20px}.group-dialog{width:min(590px,95vw);background:#131720;border:1px solid rgba(255,255,255,.12);border-radius:19px;box-shadow:0 28px 80px rgba(0,0,0,.48);padding:20px}.dialog-title{display:flex;align-items:start;justify-content:space-between;padding:2px 2px 15px}.dialog-title h3{font-size:20px;margin:5px 0 0}.room-list{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:7px 0}.room-row{min-height:58px;display:grid;grid-template-columns:28px minmax(110px,1fr) minmax(90px,170px) 35px;gap:10px;align-items:center;padding:5px 6px;border-radius:10px}.room-row:hover,.room-row.selected{background:rgba(255,255,255,.035)}.check{width:22px;height:22px;border:1px solid #4b5363;border-radius:7px;background:transparent;color:#fff;font-size:12px;cursor:pointer}.room-row.selected .check{background:var(--accent);border-color:var(--accent)}.room-copy{border:0;background:transparent;text-align:left;padding:0;cursor:pointer}.room-copy strong,.room-copy span{display:block}.room-copy strong{font-size:11px}.room-copy span{font-size:8px;color:var(--muted);margin-top:3px}.room-row>span{font-size:9px;color:var(--muted);text-align:right}.dialog-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:15px}
    .mobile-nav{display:none}
    @media (max-width: 1150px){.dashboard-shell{grid-template-columns:180px minmax(0,1fr) 300px}.media-grid{grid-template-columns:repeat(4,minmax(100px,1fr))}.media-card:nth-child(5){display:none}.now-playing{grid-template-columns:200px minmax(0,1fr)}.hero-art{min-height:210px}.track-heading h2{font-size:24px}}
    @media (max-width: 900px){.dashboard-shell{height:auto;min-height:780px;grid-template-columns:78px minmax(0,1fr)}.sidebar{padding:22px 11px}.brand{padding:0 11px 25px}.brand>div:last-child,.nav span,.sidebar-card{display:none}.nav{justify-content:center;padding:0}.queue-panel{position:fixed;z-index:90;right:0;top:0;bottom:0;width:min(360px,92vw);transform:translateX(105%);transition:.22s ease;box-shadow:-20px 0 55px rgba(0,0,0,.4)}.queue-panel.open{transform:none}.mobile-queue,.close-queue{display:grid}.media-grid{grid-template-columns:repeat(4,minmax(95px,1fr))}}
    @media (max-width: 650px){.dashboard-shell{display:block;border-radius:0;border-left:0;border-right:0;min-height:100vh}.sidebar{display:none}.topbar{height:78px;padding:14px 15px}.topbar h1{font-size:20px}.room-picker>span:nth-child(2),.room-picker>svg{display:none}.room-picker{width:42px;height:42px;padding:3px}.room-icon{width:34px;height:34px}.avatar{display:none}.content{padding:2px 14px 92px}.now-playing{grid-template-columns:1fr;padding:13px;gap:14px}.hero-art{min-height:0;aspect-ratio:1;max-height:390px}.track-panel{padding:3px 5px 8px}.track-heading h2{font-size:25px}.media-grid{display:flex;overflow:auto;gap:12px;padding-bottom:7px;scrollbar-width:none}.media-card{min-width:132px;width:132px}.media-card:nth-child(5){display:block}.radio-hero{padding:24px 21px}.radio-orb{width:76px;height:76px}.radio-hero h2{font-size:23px}.mobile-nav{position:fixed;z-index:70;left:0;right:0;bottom:0;height:69px;padding:6px 8px max(6px,env(safe-area-inset-bottom));background:rgba(15,18,25,.94);backdrop-filter:blur(14px);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(5,1fr)}.mobile-nav button{border:0;background:transparent;color:#727c8f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:7px;cursor:pointer}.mobile-nav button.active{color:#fff}.group-dialog{padding:16px}.room-row{grid-template-columns:28px minmax(90px,1fr) 90px 32px}.dialog-actions{display:grid;grid-template-columns:1fr 1fr}.queue-panel{padding-top:20px}}
  `;
}

if (!customElements.get("music-assistant-dashboard")) {
  customElements.define("music-assistant-dashboard", MusicAssistantDashboardCard);
}

const globalWindow = window as Window & { customCards?: Array<Record<string, unknown>> };
globalWindow.customCards = globalWindow.customCards ?? [];
if (!globalWindow.customCards.some((card) => card.type === "music-assistant-dashboard")) {
  globalWindow.customCards.push({
    type: "music-assistant-dashboard",
    name: "Music Assistant Dashboard",
    description: "A full-featured Music Assistant dashboard for Home Assistant",
    preview: true
  });
}
