import "./music-assistant-dashboard-card";
import type { MusicAssistantDashboardCard } from "./music-assistant-dashboard-card";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing demo root");

const card = document.createElement("music-assistant-dashboard") as MusicAssistantDashboardCard;
card.setConfig({ type: "custom:music-assistant-dashboard", demo: true, title: "Music" });
root.appendChild(card);
