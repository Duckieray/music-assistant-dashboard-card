"""HTTP endpoints for Music Assistant Dashboard."""

from __future__ import annotations

import re
from urllib.parse import quote

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.components.music_assistant.helpers import get_music_assistant_client
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import DATA_ENTRIES, DATA_HTTP_REGISTERED, DOMAIN

_PROXY_ID = re.compile(r"^[A-Za-z0-9_-]{6,128}$")


def _get_mass(hass: HomeAssistant):
    domain_data = hass.data.get(DOMAIN, {})
    entries = domain_data.get(DATA_ENTRIES, {})
    if not entries:
        raise RuntimeError("Music Assistant Dashboard is not configured")
    music_assistant_entry_id = next(iter(entries.values()))
    return get_music_assistant_client(hass, music_assistant_entry_id)


class MusicAssistantDashboardImageView(HomeAssistantView):
    """Proxy opaque Music Assistant artwork IDs through Home Assistant."""

    url = "/music-assistant-dashboard/image/{proxy_id}"
    name = "api:music_assistant_dashboard:image"
    requires_auth = False

    async def get(self, request: web.Request, proxy_id: str) -> web.Response:
        """Return artwork resolved by the configured Music Assistant server."""
        if not _PROXY_ID.fullmatch(proxy_id):
            raise web.HTTPBadRequest(text="Invalid image identifier")

        hass: HomeAssistant = request.app["hass"]
        mass = _get_mass(hass)
        info = mass.server_info
        if info is None or not info.base_url:
            raise web.HTTPServiceUnavailable(text="Music Assistant server information is unavailable")

        try:
            size = int(request.query.get("size", "640"))
        except ValueError as err:
            raise web.HTTPBadRequest(text="Invalid image size") from err
        size = max(32, min(size, 1600))

        upstream = f"{info.base_url.rstrip('/')}/imageproxy/{quote(proxy_id, safe='')}?size={size}"
        headers: dict[str, str] = {}
        token = getattr(getattr(mass, "connection", None), "auth_token", None)
        if token:
            headers["Authorization"] = f"Bearer {token}"

        session = async_get_clientsession(hass)
        try:
            async with session.get(upstream, headers=headers, timeout=15) as response:
                if response.status == 404:
                    raise web.HTTPNotFound(text="Artwork not found")
                if response.status >= 400:
                    raise web.HTTPBadGateway(text=f"Music Assistant returned HTTP {response.status}")
                body = await response.read()
                content_type = response.headers.get("Content-Type", "image/jpeg").split(";", 1)[0]
        except web.HTTPException:
            raise
        except Exception as err:  # noqa: BLE001
            raise web.HTTPBadGateway(text=f"Could not load artwork: {err}") from err

        return web.Response(
            body=body,
            content_type=content_type,
            headers={"Cache-Control": "public, max-age=86400"},
        )


def async_register_http(hass: HomeAssistant) -> None:
    """Register HTTP views once per Home Assistant process."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_HTTP_REGISTERED):
        return
    hass.http.register_view(MusicAssistantDashboardImageView())
    domain_data[DATA_HTTP_REGISTERED] = True
