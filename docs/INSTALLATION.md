# Install Music Assistant Dashboard

This guide is intentionally short. A normal installation should take about five minutes.

## Before you start

You need:

- Home Assistant 2026.10 or newer.
- Music Assistant already installed and working in **Settings → Devices & services**.
- HACS / Home Assistant Marketplace installed.

You do **not** need a Music Assistant token, server URL, or a manually copied JavaScript file.

---

## Install in 5 steps

### 1. Add the repository to HACS

Until Music Assistant Dashboard is accepted into the default HACS catalog:

1. Open **HACS / Marketplace**.
2. Open the **⋮** menu.
3. Choose **Custom repositories**.
4. Paste:

   `https://github.com/Duckieray/music-assistant-dashboard-card`

5. Choose **Integration** as the category.
6. Click **Add**.

<!-- SCREENSHOT: docs/images/install-01-custom-repository.png
Capture the HACS Custom repositories dialog with the repo URL filled in and Integration selected. -->

### 2. Download Music Assistant Dashboard

1. Search HACS for **Music Assistant Dashboard**.
2. Open it.
3. Click **Download**.
4. Choose the newest release and confirm.

<!-- SCREENSHOT: docs/images/install-02-download.png
Capture the Music Assistant Dashboard HACS page with the Download button visible. -->

### 3. Restart Home Assistant

After HACS finishes installing:

1. Open **Settings → System**.
2. Choose **Restart Home Assistant**.
3. Wait for Home Assistant to come back.

<!-- SCREENSHOT: docs/images/install-03-restart.png
Capture Home Assistant's restart control/dialog. -->

### 4. Add the integration

1. Open **Settings → Devices & services**.
2. Click **Add integration**.
3. Search for **Music Assistant Dashboard**.
4. Select it.
5. If you have more than one Music Assistant instance, choose the one this dashboard should use.

There is no token or URL to enter. The integration reuses Home Assistant's existing authenticated Music Assistant connection.

<!-- SCREENSHOT: docs/images/install-04-add-integration.png
Capture the Add integration search with Music Assistant Dashboard visible. -->

### 5. Add the dashboard card

1. Open the Home Assistant dashboard where you want the music UI.
2. Enter **Edit dashboard** mode.
3. Click **Add card**.
4. Search for **Music Assistant Dashboard**.
5. Add it and save.

No configuration is required for the default setup.

```yaml
type: custom:music-assistant-dashboard
```

<!-- SCREENSHOT: docs/images/install-05-add-card.png
Capture the Add card picker showing Music Assistant Dashboard, plus a second crop of the card after adding it. -->

That's it. Your Music Assistant players, Now Playing information, queue, library, playlists, radio, search, artwork, and supported multi-room controls should load automatically.

---

# Troubleshooting

Start at the top. Most problems are fixed by one of the first three items.

## “Custom element doesn't exist: music-assistant-dashboard”

1. Restart Home Assistant once more.
2. Hard-refresh the browser or fully close/reopen the Home Assistant app.
3. Open **Settings → Dashboards → Resources**.
4. Look for a module resource beginning with:

   `/music-assistant-dashboard/music-assistant-dashboard-card.js`

The integration normally creates this resource automatically.

If you use YAML-managed Lovelace resources, add this manually:

```yaml
resources:
  - url: /music-assistant-dashboard/music-assistant-dashboard-card.js
    type: module
```

<!-- SCREENSHOT: docs/images/troubleshoot-01-resource.png
Capture Settings → Dashboards → Resources with the auto-created Music Assistant Dashboard module highlighted. -->

## Music Assistant Dashboard does not appear under Add Integration

- Confirm HACS shows **Music Assistant Dashboard** as installed.
- Restart Home Assistant after installing or updating it.
- Confirm the folder exists as `custom_components/music_assistant_dashboard` if you are doing a manual developer install.

## The dashboard opens but no real players/library appear

Open **Settings → Devices & services → Music Assistant** and make sure the official Music Assistant integration is connected and its media-player entities are available.

Music Assistant Dashboard deliberately reuses that authenticated connection; it does not maintain a second token in Lovelace.

## Artwork is missing

- Hard-refresh the browser after upgrading from an older version of the dashboard.
- Confirm Music Assistant itself shows artwork for the same item.
- If only one provider fails to show art, include the provider name and browser-console error in a GitHub issue.

The dashboard prefers provider-hosted artwork when it is browser-accessible and proxies private/local Music Assistant artwork through Home Assistant.

## I cannot group two speakers

- Both speakers must be available in Music Assistant.
- The player provider must support grouping those two players.
- Use **Playing in → Rooms & grouping**. The current group leader is labeled **Leader**; check another compatible room to add it and uncheck it to remove it.
- If Music Assistant itself refuses the grouping request, the dashboard displays that error rather than pretending the rooms were grouped.

## The old version still appears after an update

Home Assistant and browsers cache frontend modules aggressively.

1. Restart Home Assistant.
2. Hard-refresh the browser (`Ctrl+Shift+R` / `Cmd+Shift+R`).
3. Open **Settings → Dashboards → Resources** and confirm there is only one Music Assistant Dashboard resource.
4. Keep the packaged resource beginning with:

   `/music-assistant-dashboard/music-assistant-dashboard-card.js`

5. Remove any legacy development resource beginning with:

   `/local/music-assistant-dashboard-card.js`

6. On mobile, fully close and reopen the Home Assistant app.

A legacy `/local/` module can load first and claim the custom element before the packaged HACS frontend loads, which makes an old UI appear even after a successful update. Starting with v0.1.3, storage-managed Lovelace installations automatically remove that legacy resource during integration startup.

## Still stuck?

Open an issue at:

`https://github.com/Duckieray/music-assistant-dashboard-card/issues`

Please include:

- Home Assistant version
- Music Assistant version
- Music Assistant Dashboard version
- browser/app being used
- the exact error text
- a screenshot
- relevant Home Assistant log lines

Do **not** post Music Assistant access tokens or Home Assistant credentials.
