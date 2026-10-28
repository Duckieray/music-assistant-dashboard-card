import { installArtworkBindings } from "./artwork-bindings";
import { installGroupingBindings } from "./grouping-bindings";
import { installHomeAssistantBridgeBindings } from "./ha-bridge-bindings";
import { installLiveBindings } from "./live-bindings";
import { installLiveMediaBindings } from "./live-media-bindings";
import { installPolishBindings } from "./polish-bindings";

installLiveBindings();
installHomeAssistantBridgeBindings();
installLiveMediaBindings();
installArtworkBindings();
installGroupingBindings();
installPolishBindings();

type CustomCardRegistry = Array<{
  type: string;
  name: string;
  description: string;
  preview?: boolean;
}>;

const registryHost = window as unknown as { customCards?: CustomCardRegistry };
registryHost.customCards ??= [];
if (!registryHost.customCards.some((card) => card.type === "music-assistant-dashboard")) {
  registryHost.customCards.push({
    type: "music-assistant-dashboard",
    name: "Music Assistant Dashboard",
    description: "A full-featured Music Assistant dashboard with player control, library browsing, queue management, and multi-room audio.",
    preview: true,
  });
}

export { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";