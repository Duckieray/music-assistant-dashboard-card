import { installArtworkBindings } from "./artwork-bindings";
import { installGroupingBindings } from "./grouping-bindings";
import { installHomeAssistantBridgeBindings } from "./ha-bridge-bindings";
import { installLiveBindings } from "./live-bindings";
import { installLiveMediaBindings } from "./live-media-bindings";

installLiveBindings();
installHomeAssistantBridgeBindings();
installLiveMediaBindings();
installArtworkBindings();
installGroupingBindings();

export { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";
