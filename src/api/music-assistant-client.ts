import type {
  ErrorResultMessage,
  MassEvent,
  MassPlayer,
  PlayerQueue,
  QueueItem,
  RepeatMode,
  ServerInfoMessage,
  SuccessResultMessage
} from "./types";

type EventHandler = (event: MassEvent) => void;
type StateHandler = (state: ClientState) => void;
type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  chunks: unknown[];
};

export type ClientState = "disconnected" | "connecting" | "authenticating" | "connected" | "error";

const COMMAND_TIMEOUT_MS = 12_000;

function websocketUrl(address: string): string {
  let value = address.trim().replace(/\/$/, "");
  if (value.startsWith("http://")) value = `ws://${value.slice(7)}`;
  else if (value.startsWith("https://")) value = `wss://${value.slice(8)}`;
  if (!value.startsWith("ws://") && !value.startsWith("wss://")) value = `ws://${value}`;
  if (!value.endsWith("/ws")) value += "/ws";
  return value;
}

function httpBaseUrl(address: string): string {
  let value = address.trim().replace(/\/$/, "");
  if (value.startsWith("ws://")) value = `http://${value.slice(5)}`;
  else if (value.startsWith("wss://")) value = `https://${value.slice(6)}`;
  if (value.endsWith("/ws")) value = value.slice(0, -3);
  return value;
}

export class MusicAssistantClient {
  readonly wsUrl: string;
  readonly baseUrl: string;
  private readonly token?: string;
  private ws?: WebSocket;
  private counter = 0;
  private pending = new Map<string, PendingCommand>();
  private eventHandlers = new Set<EventHandler>();
  private stateHandlers = new Set<StateHandler>();
  private connectResolve?: () => void;
  private connectReject?: (reason: unknown) => void;
  private connectPromise?: Promise<void>;
  private queueCache = new Map<string, PlayerQueue>();

  state: ClientState = "disconnected";
  serverInfo?: ServerInfoMessage;
  lastError?: string;

  constructor(address: string, token?: string) {
    this.wsUrl = websocketUrl(address);
    this.baseUrl = httpBaseUrl(address);
    this.token = token?.trim() || undefined;
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onState(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  private setState(state: ClientState, error?: string): void {
    this.state = state;
    this.lastError = error;
    for (const handler of this.stateHandlers) handler(state);
  }

  connect(): Promise<void> {
    if (this.state === "connected") return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    this.setState("connecting");
    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      try {
        this.open();
      } catch (error) {
        this.failConnection(error);
      }
    });
    return this.connectPromise;
  }

  disconnect(): void {
    this.rejectPending(new Error("Music Assistant connection closed"));
    this.ws?.close();
    this.ws = undefined;
    this.queueCache.clear();
    this.connectPromise = undefined;
    this.connectResolve = undefined;
    this.connectReject = undefined;
    this.setState("disconnected");
  }

  private open(): void {
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    ws.onmessage = (event) => this.handleMessage(String(event.data));
    ws.onerror = () => this.failConnection(new Error(`Could not connect to ${this.wsUrl}`));
    ws.onclose = () => {
      if (this.state !== "error") this.setState("disconnected");
      this.rejectPending(new Error("Music Assistant connection lost"));
      this.connectPromise = undefined;
    };
  }

  private async handleMessage(raw: string): Promise<void> {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    if ("server_version" in message && "server_id" in message && !("event" in message)) {
      this.serverInfo = message as unknown as ServerInfoMessage;
      if (this.token) {
        this.setState("authenticating");
        try {
          await this.sendCommand("auth", {
            token: this.token,
            device_name: "Home Assistant Music Dashboard"
          }, true);
        } catch (error) {
          this.failConnection(error);
          return;
        }
      }
      this.setState("connected");
      this.connectResolve?.();
      this.connectResolve = undefined;
      this.connectReject = undefined;
      return;
    }

    if ("event" in message) {
      const event = message as unknown as MassEvent;
      // MA sends the complete PlayerQueue in queue_updated events. Mutate the cached
      // object in place so consumers holding references immediately see new index/state/
      // shuffle/repeat values before they refetch queue items.
      if (event.event === "queue_updated" && event.data && typeof event.data === "object") {
        const updated = event.data as PlayerQueue;
        if (updated.queue_id) {
          const cached = this.queueCache.get(updated.queue_id);
          if (cached) Object.assign(cached, updated);
          else this.queueCache.set(updated.queue_id, updated);
        }
      }
      for (const handler of this.eventHandlers) handler(event);
      return;
    }

    const id = typeof message.message_id === "string" ? message.message_id : undefined;
    if (!id) return;
    const pending = this.pending.get(id);
    if (!pending) return;

    if ("error_code" in message) {
      clearTimeout(pending.timer);
      this.pending.delete(id);
      const result = message as unknown as ErrorResultMessage;
      pending.reject(new Error(result.details || `Music Assistant error ${result.error_code}`));
      return;
    }

    if (!("result" in message)) return;
    const result = message as unknown as SuccessResultMessage;
    if (result.partial && Array.isArray(result.result)) {
      pending.chunks.push(...result.result);
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (pending.chunks.length && Array.isArray(result.result)) {
      pending.resolve([...pending.chunks, ...result.result]);
    } else {
      pending.resolve(result.result);
    }
  }

  private failConnection(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.setState("error", error.message);
    this.connectReject?.(error);
    this.connectReject = undefined;
    this.connectResolve = undefined;
    this.connectPromise = undefined;
  }

  private rejectPending(reason: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.pending.clear();
  }

  sendCommand<T>(command: string, args: Record<string, unknown> = {}, allowBeforeConnected = false): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Music Assistant WebSocket is not open"));
    }
    if (!allowBeforeConnected && this.state !== "connected") {
      return Promise.reject(new Error("Music Assistant is not authenticated yet"));
    }

    const messageId = String(++this.counter);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new Error(`Music Assistant command timed out: ${command}`));
      }, COMMAND_TIMEOUT_MS);
      this.pending.set(messageId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
        chunks: []
      });
      this.ws!.send(JSON.stringify({ message_id: messageId, command, args }));
    });
  }

  getPlayers(): Promise<MassPlayer[]> {
    return this.sendCommand("players/all");
  }

  async getQueues(): Promise<PlayerQueue[]> {
    const queues = await this.sendCommand<PlayerQueue[]>("player_queues/all");
    this.queueCache.clear();
    for (const queue of queues) this.queueCache.set(queue.queue_id, queue);
    return queues;
  }

  getQueueItems(queueId: string, limit = 500): Promise<QueueItem[]> {
    return this.sendCommand("player_queues/items", { queue_id: queueId, limit, offset: 0 });
  }

  playPause(queueId: string): Promise<void> {
    return this.sendCommand("player_queues/play_pause", { queue_id: queueId });
  }

  next(queueId: string): Promise<void> {
    return this.sendCommand("player_queues/next", { queue_id: queueId });
  }

  previous(queueId: string): Promise<void> {
    return this.sendCommand("player_queues/previous", { queue_id: queueId });
  }

  seek(queueId: string, position: number): Promise<void> {
    return this.sendCommand("player_queues/seek", { queue_id: queueId, position });
  }

  setVolume(playerId: string, volume: number): Promise<void> {
    return this.sendCommand("players/cmd/volume_set", { player_id: playerId, volume_level: volume });
  }

  setShuffle(queueId: string, enabled: boolean): Promise<void> {
    return this.sendCommand("player_queues/shuffle", { queue_id: queueId, shuffle_enabled: enabled });
  }

  setRepeat(queueId: string, mode: RepeatMode): Promise<void> {
    return this.sendCommand("player_queues/repeat", { queue_id: queueId, repeat_mode: mode });
  }

  playIndex(queueId: string, index: number): Promise<void> {
    return this.sendCommand("player_queues/play_index", { queue_id: queueId, index });
  }

  moveQueueItem(queueId: string, itemId: string, shift: number): Promise<void> {
    return this.sendCommand("player_queues/move_item", {
      queue_id: queueId,
      queue_item_id: itemId,
      pos_shift: shift
    });
  }

  deleteQueueItem(queueId: string, itemId: string): Promise<void> {
    return this.sendCommand("player_queues/delete_item", {
      queue_id: queueId,
      item_id_or_index: itemId
    });
  }

  clearQueue(queueId: string): Promise<void> {
    return this.sendCommand("player_queues/clear", { queue_id: queueId });
  }

  imageUrl(image?: { proxy_id?: string | null; path?: string; remotely_accessible?: boolean } | null, size = 512): string | undefined {
    if (!image) return undefined;
    if (image.proxy_id) return `${this.baseUrl}/imageproxy/${image.proxy_id}?size=${size}`;
    if (image.remotely_accessible && image.path) return image.path;
    return undefined;
  }
}
