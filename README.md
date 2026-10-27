# Music Assistant Dashboard Card

A polished, full-featured Music Assistant dashboard for Home Assistant.

> **Status:** interactive UI prototype. The current branch uses synthetic music data so the product direction can be reviewed before the Music Assistant API layer is wired in.

The goal is to make Music Assistant feel like a first-class music application inside Home Assistant: beautiful now-playing controls, browsing, playlists, radio, a robust queue, and multi-room player control.

## Prototype

The `prototype/v0-ui` branch contains the first interactive design pass.

Implemented for review:

- Responsive desktop, tablet, and phone layouts
- Persistent desktop queue and mobile queue drawer
- Now Playing artwork, transport, progress, shuffle, repeat, favorite, and volume controls
- Multi-room player/group dialog with per-room volume controls
- Listen Now shelves
- Library, Playlists, Radio, and Search views
- Interactive synthetic queue: play-from-here, reorder, remove, and clear
- Self-contained generated artwork so the prototype has no image-service dependency
- Home Assistant custom-card registration as `custom:music-assistant-dashboard`

Not wired yet:

- Music Assistant WebSocket/API
- Real Home Assistant entities/services
- Real artwork and provider metadata
- Persistence/config editor
- Drag-and-drop queue reorder
- HACS release packaging

### Run the standalone prototype

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The development page renders the same custom element that will be used inside Home Assistant.

### Build the Home Assistant card

```bash
npm install
npm run build
```

The library build outputs `dist/music-assistant-dashboard-card.js`.

Eventually the Lovelace configuration will look like:

```yaml
type: custom:music-assistant-dashboard
```

## Design principle

This project is intentionally a dashboard/workspace rather than a compact media-player card. It should make browsing and managing Music Assistant pleasant enough to replace opening a separate music app for normal household playback.
