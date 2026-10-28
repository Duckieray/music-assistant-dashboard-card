import { html, nothing, type TemplateResult } from "lit";
import { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";
import type { DashboardConfig, Player } from "./types";

const BRIDGE_ADDRESS = "ha-music-assistant-dashboard-bridge";
const SET_MEMBERS_FEATURE = "set_members";

type BridgeHass = {
  callWS<T>(message: Record<string, unknown>): Promise<T>;
};

type RawPlayer = {
  player_id: string;
  name: string;
  display_name?: string;
  available: boolean;
  volume_level?: number | null;
  supported_features?: string[];
  group_members?: string[];
  can_group_with?: string[];
  synced_to?: string | null;
};

type GroupCard = {
  hass?: BridgeHass;
  config?: DashboardConfig;
  liveMode?: boolean;
  livePlayers?: Player[];
  playerId: string;
  volume: number;
  groupOpen: boolean;
  requestUpdate(): void;
};

type CardPrototype = Record<string, unknown>;

type TopologyState = {
  loaded: boolean;
  loading?: Promise<void>;
  players: Map<string, RawPlayer>;
};

const pending = new WeakMap<GroupCard, Set<string>>();
const errors = new WeakMap<GroupCard, string>();
const topologyStates = new WeakMap<GroupCard, TopologyState>();
const dialogOpenStates = new WeakMap<GroupCard, boolean>();

function topologyFor(card: GroupCard): TopologyState {
  let state = topologyStates.get(card);
  if (!state) {
    state = { loaded: false, players: new Map<string, RawPlayer>() };
    topologyStates.set(card, state);
  }
  return state;
}

function isBridgeCard(card: GroupCard): boolean {
  return card.liveMode === true
    && (card.config?.server_url === BRIDGE_ADDRESS || card.config?.url === BRIDGE_ADDRESS)
    && typeof card.hass?.callWS === "function";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown; error?: unknown };
    if (typeof value.message === "string") return value.message;
    if (value.error && typeof value.error === "object") {
      const nested = value.error as { message?: unknown };
      if (typeof nested.message === "string") return nested.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      // fall through
    }
  }
  return String(error);
}

function isUnsupportedFeature(error: unknown): boolean {
  const message = errorMessage(error).toLocaleLowerCase();
  return message.includes("unsupportedfeaturedexception")
    || message.includes("feature is not supported")
    || message.includes("feature not supported");
}

function selectedLeader(card: GroupCard): Player | undefined {
  const players = card.livePlayers ?? [];
  const selected = players.find((player) => player.id === card.playerId) ?? players[0];
  if (!selected) return undefined;
  if (selected.syncedTo) return players.find((player) => player.id === selected.syncedTo) ?? selected;
  return selected;
}

function isMember(leader: Player, candidate: Player): boolean {
  return candidate.id === leader.id
    || candidate.syncedTo === leader.id
    || Boolean(leader.groupMembers?.includes(candidate.id));
}

function supportsEditableGroup(card: GroupCard, leader: Player | undefined): boolean {
  if (!leader) return false;
  return topologyFor(card).players.get(leader.id)?.supported_features?.includes(SET_MEMBERS_FEATURE) === true;
}

function canGroupWith(card: GroupCard, leader: Player | undefined, candidate: Player): boolean {
  if (!leader) return false;
  if (isMember(leader, candidate)) return true;
  const rawLeader = topologyFor(card).players.get(leader.id);
  return rawLeader?.can_group_with?.includes(candidate.id) === true;
}

function applyTopology(card: GroupCard, rawPlayers: RawPlayer[]): void {
  const state = topologyFor(card);
  state.players = new Map(rawPlayers.map((player) => [player.player_id, player]));

  const existing = new Map((card.livePlayers ?? []).map((player) => [player.id, player]));
  card.livePlayers = rawPlayers.map((raw) => {
    const previous = existing.get(raw.player_id);
    const groupMembers = raw.group_members ?? [];
    return {
      id: raw.player_id,
      name: raw.display_name || raw.name || previous?.name || raw.player_id,
      room: previous?.room || raw.name || "",
      volume: raw.volume_level ?? previous?.volume ?? 0,
      active: raw.player_id === card.playerId,
      grouped: Boolean(raw.synced_to) || groupMembers.length > 1,
      available: raw.available,
      syncedTo: raw.synced_to ?? null,
      groupMembers,
      canGroupWith: raw.can_group_with ?? [],
    };
  });
}

async function refreshTopology(card: GroupCard): Promise<void> {
  if (!card.hass?.callWS) return;
  const state = topologyFor(card);
  if (state.loading) {
    await state.loading;
    return;
  }

  const loading = card.hass.callWS<RawPlayer[]>({
    type: "music_assistant_dashboard/players",
  }).then((rawPlayers) => {
    applyTopology(card, rawPlayers);
    state.loaded = true;
  }).finally(() => {
    state.loading = undefined;
    card.requestUpdate();
  });

  state.loading = loading;
  card.requestUpdate();
  await loading;
}

async function setMembers(
  card: GroupCard,
  leaderId: string,
  add: string[] = [],
  remove: string[] = [],
): Promise<void> {
  if (!card.hass?.callWS) return;
  await card.hass.callWS({
    type: "music_assistant_dashboard/command",
    action: "set_members",
    args: {
      target_player: leaderId,
      ...(add.length ? { player_ids_to_add: add } : {}),
      ...(remove.length ? { player_ids_to_remove: remove } : {}),
    },
  });
}

async function applyDesiredMembership(
  card: GroupCard,
  leader: Player,
  candidate: Player,
  shouldBeGrouped: boolean,
): Promise<void> {
  if (shouldBeGrouped) {
    await setMembers(card, leader.id, [candidate.id], []);
  } else {
    await setMembers(card, leader.id, [], [candidate.id]);
  }
}

async function mutateMember(card: GroupCard, candidateId: string): Promise<void> {
  let current = pending.get(card);
  if (!current) {
    current = new Set<string>();
    pending.set(card, current);
  }
  if (current.has(candidateId)) return;
  current.add(candidateId);
  errors.delete(card);
  card.requestUpdate();

  try {
    // Re-read MA immediately before changing topology. Sonos may briefly expose stale
    // grouping capabilities after startup/reload, which can cause first-click failures.
    await refreshTopology(card);

    let leader = selectedLeader(card);
    let candidate = card.livePlayers?.find((player) => player.id === candidateId);
    if (!leader || !candidate || candidate.id === leader.id) return;

    const shouldBeGrouped = !isMember(leader, candidate);
    if (!supportsEditableGroup(card, leader)) {
      throw new Error("Music Assistant has not reported editable grouping for this player yet.");
    }
    if (shouldBeGrouped && !canGroupWith(card, leader, candidate)) {
      throw new Error(`${candidate.name} is not currently reported as compatible with ${leader.name}.`);
    }

    try {
      await applyDesiredMembership(card, leader, candidate, shouldBeGrouped);
    } catch (error) {
      if (!isUnsupportedFeature(error)) throw error;

      // One retry only, after forcing a fresh topology read. If the first command actually
      // succeeded despite the transient error, the fresh topology already reflects the desired
      // state and we intentionally do not send the inverse operation.
      await refreshTopology(card);
      leader = selectedLeader(card);
      candidate = card.livePlayers?.find((player) => player.id === candidateId);
      if (!leader || !candidate || candidate.id === leader.id) return;

      const currentlyGrouped = isMember(leader, candidate);
      if (currentlyGrouped !== shouldBeGrouped) {
        if (!supportsEditableGroup(card, leader)
          || (shouldBeGrouped && !canGroupWith(card, leader, candidate))) {
          throw new Error("Music Assistant is still initializing grouping for these speakers. Reopen Rooms & grouping and try again.");
        }
        await applyDesiredMembership(card, leader, candidate, shouldBeGrouped);
      }
    }

    await refreshTopology(card);
  } catch (error) {
    errors.set(card, errorMessage(error));
  } finally {
    current.delete(candidateId);
    card.requestUpdate();
  }
}

export function installGroupingBindings(): void {
  const proto = MusicAssistantDashboardCard.prototype as unknown as CardPrototype;
  if (proto.__groupingBindingsInstalled) return;
  proto.__groupingBindingsInstalled = true;

  const originalRenderGroupDialog = proto.renderGroupDialog as (
    this: GroupCard,
  ) => TemplateResult | typeof nothing;

  proto.renderGroupDialog = function renderGroupDialog(this: GroupCard): TemplateResult | typeof nothing {
    const wasOpen = dialogOpenStates.get(this) ?? false;
    if (!this.groupOpen) {
      dialogOpenStates.set(this, false);
      return nothing;
    }
    if (!isBridgeCard(this)) return originalRenderGroupDialog.call(this);

    const topology = topologyFor(this);
    if (!wasOpen) {
      dialogOpenStates.set(this, true);
      topology.loaded = false;
      errors.delete(this);
      void refreshTopology(this);
    } else if (!topology.loaded && !topology.loading) {
      void refreshTopology(this);
    }

    const players = this.livePlayers ?? [];
    const leader = selectedLeader(this);
    const busy = pending.get(this) ?? new Set<string>();
    const error = errors.get(this);
    const leaderEditable = supportsEditableGroup(this, leader);

    return html`
      <div class="modal-backdrop" @click=${() => { this.groupOpen = false; }}>
        <div class="group-dialog" @click=${(event: Event) => event.stopPropagation()}>
          <div class="dialog-title">
            <div>
              <span class="eyebrow">MULTI-ROOM AUDIO</span>
              <h3>Rooms & grouping</h3>
            </div>
            <button class="icon-button" @click=${() => { this.groupOpen = false; }}>×</button>
          </div>

          ${leader ? html`
            <p style="margin:0 0 12px;color:var(--secondary-text-color,#a7adbd);font-size:13px;line-height:1.45">
              Playing from <strong style="color:var(--primary-text-color,#fff)">${leader.name}</strong>.
              Click a room name to select it. Use the checkbox only to add or remove compatible speakers from the group.
            </p>
          ` : nothing}

          ${topology.loading ? html`
            <div style="margin:0 0 12px;color:var(--secondary-text-color,#a7adbd);font-size:12px">
              Checking speaker compatibility…
            </div>
          ` : nothing}

          ${error ? html`
            <div style="margin:0 0 12px;padding:10px 12px;border-radius:10px;background:rgba(255,90,100,.12);color:#ff9aa2;font-size:12px">
              Grouping failed: ${error}
            </div>
          ` : nothing}

          <div class="room-list">
            ${players.map((player) => {
              const grouped = leader ? isMember(leader, player) : false;
              const isLeader = player.id === leader?.id;
              const isBusy = busy.has(player.id);
              const compatible = leader ? canGroupWith(this, leader, player) : false;
              const groupingAvailable = topology.loaded
                && leaderEditable
                && (grouped || compatible)
                && player.available !== false;
              const checkboxDisabled = isLeader || isBusy || !groupingAvailable;
              const status = player.available === false
                ? "Unavailable"
                : player.id === this.playerId
                  ? "Selected"
                  : grouped
                    ? "Grouped"
                    : topology.loading || !topology.loaded
                      ? "Checking compatibility…"
                      : !leaderEditable
                        ? "Grouping unavailable"
                        : compatible
                          ? "Available to group"
                          : "Not group-compatible";
              const title = isLeader
                ? "Group leader"
                : grouped
                  ? `Remove ${player.name} from group`
                  : compatible
                    ? `Group ${player.name} with ${leader?.name ?? "selected player"}`
                    : `${player.name} cannot currently be grouped with ${leader?.name ?? "selected player"}`;

              return html`
                <div class=${player.id === this.playerId ? "room-row selected" : "room-row"}>
                  <button
                    class="check"
                    ?disabled=${checkboxDisabled}
                    title=${title}
                    @click=${() => { if (!checkboxDisabled) void mutateMember(this, player.id); }}
                  >${isBusy ? "…" : grouped ? "✓" : ""}</button>

                  <button class="room-copy" @click=${() => {
                    // Selecting a room never mutates a group.
                    this.playerId = player.id;
                    this.livePlayers = players.map((candidate) => ({ ...candidate, active: candidate.id === player.id }));
                    this.volume = player.volume;
                    errors.delete(this);
                    topology.loaded = false;
                    this.requestUpdate();
                    void refreshTopology(this);
                  }}>
                    <strong>${player.name}${isLeader ? " • Leader" : ""}</strong>
                    <span>${status}</span>
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    .value=${String(player.id === this.playerId ? this.volume : player.volume)}
                    @change=${(event: Event) => {
                      const value = Number((event.target as HTMLInputElement).value);
                      if (player.id === this.playerId) this.volume = value;
                      if (this.hass?.callWS) {
                        void this.hass.callWS({
                          type: "music_assistant_dashboard/command",
                          action: "volume_set",
                          args: { player_id: player.id, volume_level: value },
                        });
                      }
                    }}
                  />
                  <span>${Math.round(player.id === this.playerId ? this.volume : player.volume)}%</span>
                </div>
              `;
            })}
          </div>

          <div class="dialog-actions">
            <button class="secondary-action" @click=${() => {
              topology.loaded = false;
              void refreshTopology(this);
            }}>Refresh</button>
            <button class="primary-action" @click=${() => { this.groupOpen = false; }}>Done</button>
          </div>
        </div>
      </div>
    `;
  };
}
