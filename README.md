# Music Assistant Dashboard Card

A polished, full-featured Music Assistant dashboard for Home Assistant.

> **Status:** early live prototype. The approved v0 interface now has a direct Music Assistant WebSocket layer for real players, Now Playing, transport, volume, artwork, and queue control. Library/discovery views still use prototype content while their MA data sources are being implemented.

The goal is to make Music Assistant feel like a first-class music application inside Home Assistant: beautiful now-playing controls, browsing, playlists, radio, a robust queue, and multi-room player control.

## Current prototype

The `prototype/v0-ui` branch contains the current development build.

### Live now

- Responsive desktop, tablet, and phone layouts
- Direct Music Assistant WebSocket connection and access-token authentication
- Dynamic Music Assistant player discovery
- Real current player / room selection
- Real Now Playing title, artist, album, duration, elapsed time, and artwork
- Play/pause, previous, next, seek, shuffle, repeat, and volume commands
- Real Music Assistant queue
- Play from queue, move up/down, remove, clear, and shuffle controls
- Queue/player updates driven by Music Assistant events
- Per-player volume control in the room picker
- Persistent desktop queue and mobile queue drawer
- Home Assistant custom-card registration as `custom:music-assistant-dashboard`

### Still prototype data / upcoming

- Listen Now recommendation shelves
- Library, Playlists, Radio, and Search results
- Multi-room grouping and queue transfer actions
- Favorite actions
- Persistence/config editor
- Drag-and-drop queue reorder
- HACS release packaging

## Run the standalone design demo

```bash
npm install
npm run dev
```

The standalone Vite page intentionally uses `demo: true`, so it does not require a Music Assistant server.

## Build the Home Assistant card

```bash
npm install
npm run build
```

The library build outputs `dist/music-assistant-dashboard-card.js`.

## Test with a real Music Assistant server

Create an access token in **Music Assistant → Settings → Authentication**, then configure the card with your Music Assistant server address:

```yaml
type: custom:music-assistant-dashboard
server_url: http://192.168.1.50:8095
token: YOUR_MUSIC_ASSISTANT_ACCESS_TOKEN
default_player: YOUR_OPTIONAL_MA_PLAYER_ID
```

`server_url` accepts `http://`, `https://`, `ws://`, or `wss://` addresses. The card normalizes the address and connects to Music Assistant's `/ws` endpoint automatically. `url` is also accepted as an alias for `server_url`.

If Home Assistant itself is served over HTTPS, the browser may block an insecure `ws://` Music Assistant connection as mixed content. In that case Music Assistant needs to be reachable through `wss://`/HTTPS as well. A future Home Assistant-native transport can remove the need for a browser-direct token/connection.

### Token note

This is an early direct-client prototype. The token currently lives in Lovelace card configuration, so treat it like any other dashboard credential and do not publish a real token in screenshots, example YAML, issues, or repository files. Moving credentials behind a Home Assistant-side integration is on the architecture roadmap before a stable release.

## Design principle

This project is intentionally a dashboard/workspace rather than a compact media-player card. It should make browsing and managing Music Assistant pleasant enough to replace opening a separate music app for normal household playback.
