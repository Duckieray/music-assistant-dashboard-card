import { MusicAssistantClient, type ClientState } from "./api/music-assistant-client";
import type { MassEvent, MassPlayer, PlayerQueue, QueueItem, RepeatMode } from "./api/types";
import { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";
import type { DashboardConfig } from "./types";

const BRIDGE_ADDRESS = "ha-music-assistant-dashboard-bridge";
const BRIDGE_WS_URL = `ws://${BRIDGE_ADDRESS}/ws`;
const POLL_MS = 2500;

type BridgeHass = {
  callWS<T>(message: Record<string, unknown>): Promise<T>;
};

type BridgeCard = {
  hass?: BridgeHass;
  config?: DashboardConfig;
  liveState?: ClientState;
  setConfig(config: DashboardConfig): void;
};

type CardPrototype = Record<string, unknown>;

type BridgeClientInternals = {
  baseUrl: string;
  eventHandlers: Set<(event: MassEvent) => void>;
  setState(state: ClientState, error?: string): void;
  __bridgePoll?: ReturnType<typeof setInterval>;
};

let activeHass: BridgeHass | undefined;

function isBridgeClient(client: MusicAssistantClient): boolean {
  return client.wsUrl === BRIDGE_WS_URL;
}

function bridgeInternals(client: MusicAssistantClient): BridgeClientInternals {
  return client as unknown as BridgeClientInternals;
}

async function callBridge<T>(type: string, extra: Record<string, unknown> = {}): Promise<T> {
  if (!activeHass) throw new Error("Home Assistant has not attached the dashboard bridge yet");
  return activeHass.callWS<T>({ type: `music_assistant_dashboard/${type}`, ...extra });
}

function emitRefresh(client: MusicAssistantClient): void {
  const event: MassEvent = { event: "player_updated", object_id: null, data: null };
  for (const handler of bridgeInternals(client).eventHandlers) handler(event);
}

function patchMusicAssistantClient(): void {
  const proto = MusicAssistantClient.prototype as unknown as Record<string, unknown>;
  if (proto.__haBridgeClientPatched) return;
  proto.__haBridgeClientPatched = true;

  const originalConnect = proto.connect as (this: MusicAssistantClient) => Promise<void>;
  const originalDisconnect = proto.disconnect as (this: MusicAssistantClient) => void;
  const originalGetPlayers = proto.getPlayers as (this: MusicAssistantClient) => Promise<MassPlayer[]>;
  const originalGetQueues = proto.getQueues as (this: MusicAssistantClient) => Promise<PlayerQueue[]>;
  const originalGetQueueItems = proto.getQueueItems as (this: MusicAssistantClient, queueId: string, limit?: number) => Promise<QueueItem[]>;
  const originalPlayPause = proto.playPause as (this: MusicAssistantClient, queueId: string) => Promise<void>;
  const originalNext = proto.next as (this: MusicAssistantClient, queueId: string) => Promise<void>;
  const originalPrevious = proto.previous as (this: MusicAssistantClient, queueId: string) => Promise<void>;
  const originalSeek = proto.seek as (this: MusicAssistantClient, queueId: string, position: number) => Promise<void>;
  const originalSetVolume = proto.setVolume as (this: MusicAssistantClient, playerId: string, volume: number) => Promise<void>;
  const originalSetShuffle = proto.setShuffle as (this: MusicAssistantClient, queueId: string, enabled: boolean) => Promise<void>;
  const originalSetRepeat = proto.setRepeat as (this: MusicAssistantClient, queueId: string, mode: RepeatMode) => Promise<void>;
  const originalPlayIndex = proto.playIndex as (this: MusicAssistantClient, queueId: string, index: number) => Promise<void>;
  const originalMoveQueueItem = proto.moveQueueItem as (this: MusicAssistantClient, queueId: string, itemId: string, shift: number) => Promise<void>;
  const originalDeleteQueueItem = proto.deleteQueueItem as (this: MusicAssistantClient, queueId: string, itemId: string) => Promise<void>;
  const originalClearQueue = proto.clearQueue as (this: MusicAssistantClient, queueId: string) => Promise<void>;

  proto.connect = async function connect(this: MusicAssistantClient): Promise<void> {
    if (!isBridgeClient(this)) return originalConnect.call(this);
    const internal = bridgeInternals(this);
    internal.setState("connecting");
    try {
      const info = await callBridge<{ base_url?: string | null }>("info");
      if (info.base_url) internal.baseUrl = info.base_url.replace(/\/$/, "");
      internal.setState("connected");
      if (internal.__bridgePoll) clearInterval(internal.__bridgePoll);
      internal.__bridgePoll = setInterval(() => emitRefresh(this), POLL_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      internal.setState("error", message);
      throw error;
    }
  };

  proto.disconnect = function disconnect(this: MusicAssistantClient): void {
    if (!isBridgeClient(this)) return originalDisconnect.call(this);
    const internal = bridgeInternals(this);
    if (internal.__bridgePoll) clearInterval(internal.__bridgePoll);
    internal.__bridgePoll = undefined;
    internal.setState("disconnected");
  };

  proto.getPlayers = function getPlayers(this: MusicAssistantClient): Promise<MassPlayer[]> {
    if (!isBridgeClient(this)) return originalGetPlayers.call(this);
    return callBridge("players");
  };

  proto.getQueues = function getQueues(this: MusicAssistantClient): Promise<PlayerQueue[]> {
    if (!isBridgeClient(this)) return originalGetQueues.call(this);
    return callBridge("queues");
  };

  proto.getQueueItems = function getQueueItems(this: MusicAssistantClient, queueId: string, limit = 500): Promise<QueueItem[]> {
    if (!isBridgeClient(this)) return originalGetQueueItems.call(this, queueId, limit);
    return callBridge("queue_items", { queue_id: queueId, limit, offset: 0 });
  };

  proto.playPause = function playPause(this: MusicAssistantClient, queueId: string): Promise<void> {
    if (!isBridgeClient(this)) return originalPlayPause.call(this, queueId);
    return callBridge("command", { action: "play_pause", args: { queue_id: queueId } });
  };

  proto.next = function next(this: MusicAssistantClient, queueId: string): Promise<void> {
    if (!isBridgeClient(this)) return originalNext.call(this, queueId);
    return callBridge("command", { action: "next", args: { queue_id: queueId } });
  };

  proto.previous = function previous(this: MusicAssistantClient, queueId: string): Promise<void> {
    if (!isBridgeClient(this)) return originalPrevious.call(this, queueId);
    return callBridge("command", { action: "previous", args: { queue_id: queueId } });
  };

  proto.seek = function seek(this: MusicAssistantClient, queueId: string, position: number): Promise<void> {
    if (!isBridgeClient(this)) return originalSeek.call(this, queueId, position);
    return callBridge("command", { action: "seek", args: { queue_id: queueId, position } });
  };

  proto.setVolume = function setVolume(this: MusicAssistantClient, playerId: string, volume: number): Promise<void> {
    if (!isBridgeClient(this)) return originalSetVolume.call(this, playerId, volume);
    return callBridge("command", { action: "volume_set", args: { player_id: playerId, volume_level: volume } });
  };

  proto.setShuffle = function setShuffle(this: MusicAssistantClient, queueId: string, enabled: boolean): Promise<void> {
    if (!isBridgeClient(this)) return originalSetShuffle.call(this, queueId, enabled);
    return callBridge("command", { action: "shuffle", args: { queue_id: queueId, shuffle_enabled: enabled } });
  };

  proto.setRepeat = function setRepeat(this: MusicAssistantClient, queueId: string, mode: RepeatMode): Promise<void> {
    if (!isBridgeClient(this)) return originalSetRepeat.call(this, queueId, mode);
    return callBridge("command", { action: "repeat", args: { queue_id: queueId, repeat_mode: mode } });
  };

  proto.playIndex = function playIndex(this: MusicAssistantClient, queueId: string, index: number): Promise<void> {
    if (!isBridgeClient(this)) return originalPlayIndex.call(this, queueId, index);
    return callBridge("command", { action: "play_index", args: { queue_id: queueId, index } });
  };

  proto.moveQueueItem = function moveQueueItem(this: MusicAssistantClient, queueId: string, itemId: string, shift: number): Promise<void> {
    if (!isBridgeClient(this)) return originalMoveQueueItem.call(this, queueId, itemId, shift);
    return callBridge("command", { action: "move_item", args: { queue_id: queueId, queue_item_id: itemId, pos_shift: shift } });
  };

  proto.deleteQueueItem = function deleteQueueItem(this: MusicAssistantClient, queueId: string, itemId: string): Promise<void> {
    if (!isBridgeClient(this)) return originalDeleteQueueItem.call(this, queueId, itemId);
    return callBridge("command", { action: "delete_item", args: { queue_id: queueId, item_id_or_index: itemId } });
  };

  proto.clearQueue = function clearQueue(this: MusicAssistantClient, queueId: string): Promise<void> {
    if (!isBridgeClient(this)) return originalClearQueue.call(this, queueId);
    return callBridge("command", { action: "clear", args: { queue_id: queueId } });
  };
}

export function installHomeAssistantBridgeBindings(): void {
  patchMusicAssistantClient();

  const proto = MusicAssistantDashboardCard.prototype as unknown as CardPrototype;
  if (proto.__haBridgeBindingsInstalled) return;
  proto.__haBridgeBindingsInstalled = true;

  const originalSetConfig = proto.setConfig as (this: BridgeCard, config: DashboardConfig) => void;
  const originalConnected = proto.connectedCallback as ((this: BridgeCard) => void) | undefined;
  const originalUpdated = proto.updated as ((this: BridgeCard, changed: Map<PropertyKey, unknown>) => void) | undefined;

  proto.setConfig = function setConfig(this: BridgeCard, config: DashboardConfig): void {
    if (this.hass?.callWS) activeHass = this.hass;
    const shouldUseBridge = config.demo !== true && !config.server_url && !config.url;
    originalSetConfig.call(
      this,
      shouldUseBridge ? { ...config, server_url: BRIDGE_ADDRESS } : config
    );
  };

  proto.connectedCallback = function connectedCallback(this: BridgeCard): void {
    if (this.hass?.callWS) activeHass = this.hass;
    originalConnected?.call(this);
  };

  proto.updated = function updated(this: BridgeCard, changed: Map<PropertyKey, unknown>): void {
    originalUpdated?.call(this, changed);
    if (!changed.has("hass") || !this.hass?.callWS) return;
    activeHass = this.hass;
    if (this.config?.server_url !== BRIDGE_ADDRESS || this.liveState === "connected") return;
    const nextConfig = { ...this.config };
    delete nextConfig.server_url;
    this.setConfig(nextConfig);
  };
}
