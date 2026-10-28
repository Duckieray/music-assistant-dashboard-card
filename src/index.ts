import { installHomeAssistantBridgeBindings } from "./ha-bridge-bindings";
import { installLiveBindings } from "./live-bindings";

installLiveBindings();
installHomeAssistantBridgeBindings();

export { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";
