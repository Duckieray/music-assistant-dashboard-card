# Music Assistant Dashboard

A polished, full-screen Music Assistant experience for Home Assistant.

Music Assistant Dashboard ships as a Home Assistant custom integration **and** its Lovelace frontend in one package. It reuses Home Assistant's authenticated Music Assistant connection, so normal users do not need to expose a Music Assistant token or server URL to the browser.

> **Release status:** v0.1.0 release candidate. Player/queue control, library browsing, search, artwork, and multi-room grouping are live. Favorites, drag-and-drop queue reorder, and deeper recommendation/provider views are still evolving.

## Features

- Real Music Assistant players and room selection
- Now Playing metadata and artwork
- Play/pause, previous, next, seek, shuffle, repeat, and volume
- Real queue with play-from-here, move, remove, clear, and shuffle
- Library albums, artists, and tracks
- Music Assistant playlists and radio
- Search across Music Assistant and connected providers
- Recently played content
- Multi-room grouping / ungrouping
- Per-room volume controls
- Responsive desktop, tablet, and mobile layouts
- Home Assistant-authenticated backend bridge — no Lovelace token required
- Bundled frontend resource registered automatically by the integration
- HACS release packaging

## Installation

For the normal HACS / Marketplace installation, see the intentionally simple guide:

**[Installation & troubleshooting](docs/INSTALLATION.md)**

The installation guide is written as a five-step flow and includes marked screenshot positions. The final screenshots will be captured from the clean HACS release-candidate install so they exactly match the UI users will see rather than using mockups.

The default card configuration is only:

```yaml
type: custom:music-assistant-dashboard
```

### Prerequisite

The official **Music Assistant** Home Assistant integration must already be installed and connected. Music Assistant Dashboard is a companion UI and authenticated bridge; it does not replace Music Assistant itself.

## How it works

```text
Browser / Home Assistant frontend
          │
          │ Home Assistant authenticated WebSocket
          ▼
Music Assistant Dashboard integration
          │
          │ existing authenticated Music Assistant client
          ▼
Home Assistant Music Assistant integration
          │
          ▼
Music Assistant server / players / providers
```

The dashboard never needs to place a long-lived Music Assistant token in Lovelace configuration.

Provider-public artwork is loaded directly when safe to do so. Private/local Music Assistant artwork is proxied through the companion integration so the browser does not need direct network access to the Music Assistant server.

## Developer install

The packaged HACS release is the recommended install. For development:

```bash
npm install
npm run build
```

The frontend build is written to:

```text
dist/music-assistant-dashboard-card.js
```

Build the complete HACS ZIP with:

```bash
bash scripts/build-hacs-package.sh
```

That creates:

```text
music_assistant_dashboard.zip
```

The ZIP contains the integration files at its root, including:

```text
__init__.py
config_flow.py
const.py
frontend.py
http.py
manifest.json
websocket.py
frontend/
  music-assistant-dashboard-card.js
```

## Direct Music Assistant mode

The original direct WebSocket transport is still available as an advanced/development fallback:

```yaml
type: custom:music-assistant-dashboard
server_url: http://192.168.1.50:8095
token: YOUR_MUSIC_ASSISTANT_ACCESS_TOKEN
```

For normal Home Assistant installations, omit both fields and use the companion integration.

## HACS / Marketplace publishing

This repository is structured as one HACS **Integration** repository. `hacs.json` uses a dedicated `music_assistant_dashboard.zip` release asset so the compiled frontend ships inside the same install as the Python integration.

Before each public release/submission:

1. Run **Validate and build** manually.
2. Run **HACS validation** manually.
3. Run **Hassfest** manually.
4. Run **Build HACS release package** manually.
5. Publish a GitHub Release with `music_assistant_dashboard.zip` attached.
6. Test a clean install through HACS as a custom Integration repository.
7. Capture the real install/troubleshooting screenshots listed in `docs/INSTALLATION.md`.
8. Submit the repository to `hacs/default` once the clean-install test and screenshots are complete.

The Actions workflows intentionally use manual triggers so ordinary pushes do not consume Actions minutes.

## Contributing / issues

Bug reports and feature requests are welcome in GitHub Issues. When reporting a runtime issue, include Home Assistant, Music Assistant, and Music Assistant Dashboard versions plus relevant logs. Never post access tokens or credentials.

## License

MIT
