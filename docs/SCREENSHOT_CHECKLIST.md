# Installation screenshot checklist

These screenshots are intentionally captured from a real clean HACS install so the documentation always matches Home Assistant's actual UI.

Use a desktop browser at normal zoom. Crop out unrelated dashboards, hostnames, IP addresses, usernames, and any private media titles if desired. Do not include tokens or credentials.

## 1 — Add custom repository

**File:** `docs/images/install-01-custom-repository.png`

Capture **HACS / Marketplace → ⋮ → Custom repositories** with:

- Repository: `https://github.com/Duckieray/music-assistant-dashboard-card`
- Type/category: **Integration**
- **Add** button visible

The screenshot should make this step understandable without reading the paragraph above it.

## 2 — Download

**File:** `docs/images/install-02-download.png`

Capture the **Music Assistant Dashboard** HACS page with:

- integration name visible
- current version visible
- **Download** button visible

Do not capture unrelated repositories in the sidebar if they contain personal information.

## 3 — Restart Home Assistant

**File:** `docs/images/install-03-restart.png`

Capture the Home Assistant restart confirmation from **Settings → System**. Keep the crop tight around the restart controls.

## 4 — Add integration

**File:** `docs/images/install-04-add-integration.png`

Capture **Settings → Devices & services → Add integration** with the search term `Music Assistant Dashboard` and the integration result visible.

If the next screen asks which Music Assistant instance to use, take an optional second screenshot named:

`docs/images/install-04b-select-music-assistant.png`

## 5 — Add card

**File:** `docs/images/install-05-add-card.png`

Capture the Lovelace **Add card** picker with `Music Assistant Dashboard` visible.

Then capture the successfully added dashboard as:

`docs/images/install-06-finished-dashboard.png`

Use a player/track you are comfortable showing publicly, or pause playback before taking the screenshot.

## Troubleshooting screenshot

**File:** `docs/images/troubleshoot-01-resource.png`

Capture **Settings → Dashboards → Resources** with the automatically registered resource visible:

`/music-assistant-dashboard/music-assistant-dashboard-card.js?...`

This image belongs only in the troubleshooting section; normal users should not need to visit Resources.

## Final pass

Before publishing the screenshots:

- Make sure all screenshots come from the same Home Assistant visual theme.
- Prefer PNG.
- Keep text readable on a typical GitHub README width.
- Remove browser chrome unless it helps orient the user.
- Redact local hostnames/IPs, account names, and private media if present.
- Do not annotate every control. One subtle box/arrow is enough when the target is not obvious.
