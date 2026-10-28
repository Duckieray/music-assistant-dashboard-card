import { MusicAssistantClient } from "./api/music-assistant-client";
import { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";
import type { MediaItem } from "./types";

const BRIDGE_ADDRESS = "ha-music-assistant-dashboard-bridge";
const BRIDGE_WS_URL = `ws://${BRIDGE_ADDRESS}/ws`;
const IMAGE_PROXY_PREFIX = "/music-assistant-dashboard/image/";

type CardPrototype = Record<string, unknown>;

type ImageLike = {
  proxy_id?: string | null;
  path?: string;
  remotely_accessible?: boolean;
};

function rewriteExistingUrl(url?: string): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    const marker = "/imageproxy/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return url;
    const proxyId = parsed.pathname.slice(index + marker.length).split("/")[0];
    if (!proxyId) return url;
    const size = parsed.searchParams.get("size") ?? "640";
    return `${IMAGE_PROXY_PREFIX}${encodeURIComponent(proxyId)}?size=${encodeURIComponent(size)}`;
  } catch {
    return url;
  }
}

export function installArtworkBindings(): void {
  const clientProto = MusicAssistantClient.prototype as unknown as CardPrototype;
  if (!clientProto.__haArtworkBindingsInstalled) {
    clientProto.__haArtworkBindingsInstalled = true;
    const originalImageUrl = clientProto.imageUrl as (
      this: MusicAssistantClient,
      image?: ImageLike | null,
      size?: number,
    ) => string | undefined;

    clientProto.imageUrl = function imageUrl(
      this: MusicAssistantClient,
      image?: ImageLike | null,
      size = 512,
    ): string | undefined {
      if (this.wsUrl !== BRIDGE_WS_URL) return originalImageUrl.call(this, image, size);
      if (!image) return undefined;

      // Prefer provider-hosted art when MA marks it as browser reachable.
      if (image.remotely_accessible && image.path) return image.path;
      if (image.path?.startsWith("http://") || image.path?.startsWith("https://")) return image.path;

      // For provider-private/local artwork, keep the browser on Home Assistant.
      if (image.proxy_id) {
        return `${IMAGE_PROXY_PREFIX}${encodeURIComponent(image.proxy_id)}?size=${size}`;
      }
      return undefined;
    };
  }

  const proto = MusicAssistantDashboardCard.prototype as unknown as CardPrototype;
  if (proto.__haArtworkRenderBindingsInstalled) return;
  proto.__haArtworkRenderBindingsInstalled = true;

  const originalRenderArtwork = proto.renderArtwork as (
    this: MusicAssistantDashboardCard,
    item: MediaItem,
  ) => unknown;

  proto.renderArtwork = function renderArtwork(
    this: MusicAssistantDashboardCard,
    item: MediaItem,
  ): unknown {
    if (!item.imageUrl) return originalRenderArtwork.call(this, item);
    const imageUrl = rewriteExistingUrl(item.imageUrl);
    return originalRenderArtwork.call(this, imageUrl === item.imageUrl ? item : { ...item, imageUrl });
  };
}
