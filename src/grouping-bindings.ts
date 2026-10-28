import { html, nothing, type TemplateResult } from "lit";
import { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";
import type { DashboardConfig, Player } from "./types";

const BRIDGE_ADDRESS = "ha-music-assistant-dashboard-bridge";

type BridgeHass = {
  callWS<T>(message: Record<string, unknown>): Promise<T>;
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

const pending = new WeakMap<GroupCard, Set<string>>();
const errors = new WeakMap<GroupCard, string>();

function isBridgeCard(card: GroupCard): boolean {
  return card.liveMode === true
    && (card.config?.server_url === BRIDGE_ADDRESS || card.config?.url === BRIDGE_ADDRESS)
    && typeof card.hass?.callWS === "function";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown };
    if (typeof value.message === "string") return value.message;
    try {
      return JSON.stringify(error);
    } catch {
      // fall through
    }
  }
  return String(error);
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

async function callGroupCommand(
  card: GroupCard,
  action: "group_many" | "ungroup",
  args: Record<string, unknown>,
): Promise<void> {
  if (!card.hass?.callWS) return;
  await card.hass.callWS({
    type: "music_assistant_dashboard/command",
    action,
    args,
  });
}

async function toggleMember(card: GroupCard, leader: Player, candidate: Player): Promise<void> {
  if (candidate.id === leader.id) return;
  let current = pending.get(card);
  if (!current) {
    current = new Set<string>();
    pending.set(card, current);
  }
  if (current.has(candidate.id)) return;
  current.add(candidate.id);
  errors.delete(card);
  card.requestUpdate();

  const grouped = isMember(leader, candidate);
  try {
    if (grouped) {
      await callGroupCommand(card, "ungroup", { player_id: candidate.id });
    } else {
      await callGroupCommand(card, "group_many", {
        target_player: leader.id,
        child_player_ids: [candidate.id],
      });
    }

    // Optimistic state while the normal live-player poll catches up with MA.
    if (grouped) {
      candidate.syncedTo = null;
      candidate.grouped = false;
      leader.groupMembers = (leader.groupMembers ?? []).filter((id) => id !== candidate.id);
    } else {
      candidate.syncedTo = leader.id;
      candidate.grouped = true;
      leader.groupMembers = Array.from(new Set([...(leader.groupMembers ?? []), leader.id, candidate.id]));
      leader.grouped = true;
    }
  } catch (error) {
    errors.set(card, errorMessage(error));
  } finally {
    current.delete(candidate.id);
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
    if (!this.groupOpen) return nothing;
    if (!isBridgeCard(this)) return originalRenderGroupDialog.call(this);

    const players = this.livePlayers ?? [];
    const leader = selectedLeader(this);
    const busy = pending.get(this) ?? new Set<string>();
    const error = errors.get(this);

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
              Check another room to group it with this player. Click a room name to make it the dashboard's selected player.
            </p>
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
              return html`
                <div class=${player.id === this.playerId ? "room-row selected" : "room-row"}>
                  <button
                    class="check"
                    ?disabled=${isLeader || isBusy || !player.available}
                    title=${isLeader ? "Group leader" : grouped ? `Remove ${player.name} from group` : `Group ${player.name}`}
                    @click=${() => { if (leader) void toggleMember(this, leader, player); }}
                  >${isBusy ? "…" : grouped ? "✓" : ""}</button>

                  <button class="room-copy" @click=${() => {
                    this.playerId = player.id;
                    this.livePlayers = players.map((candidate) => ({ ...candidate, active: candidate.id === player.id }));
                    this.volume = player.volume;
                    this.requestUpdate();
                  }}>
                    <strong>${player.name}${isLeader ? " • Leader" : ""}</strong>
                    <span>${!player.available ? "Unavailable" : grouped ? "Grouped" : "Available"}</span>
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
            <button class="secondary-action" @click=${() => { this.groupOpen = false; }}>Close</button>
            <button class="primary-action" @click=${() => { this.groupOpen = false; }}>Done</button>
          </div>
        </div>
      </div>
    `;
  };
}
