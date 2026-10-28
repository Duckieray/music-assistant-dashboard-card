"""Serve and register the Music Assistant Dashboard frontend module."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace import LOVELACE_DATA
from homeassistant.components.lovelace.const import CONF_RESOURCE_TYPE_WS
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.const import CONF_ID, CONF_URL
from homeassistant.core import HomeAssistant

from .const import DATA_FRONTEND_REGISTERED, DOMAIN, INTEGRATION_VERSION

_LOGGER = logging.getLogger(__name__)

RESOURCE_PATH = "/music-assistant-dashboard/music-assistant-dashboard-card.js"
RESOURCE_URL = f"{RESOURCE_PATH}?v={INTEGRATION_VERSION}"


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the bundled card and register it as a Lovelace module."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_FRONTEND_REGISTERED):
        return

    javascript_path = Path(__file__).parent / "frontend" / "music-assistant-dashboard-card.js"
    if not javascript_path.is_file():
        _LOGGER.warning(
            "Bundled dashboard JavaScript is missing at %s. "
            "Install a packaged release or build the frontend first.",
            javascript_path,
        )
        return

    await hass.http.async_register_static_paths(
        [StaticPathConfig(RESOURCE_PATH, str(javascript_path), cache_headers=True)]
    )
    domain_data[DATA_FRONTEND_REGISTERED] = True

    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None:
        _LOGGER.warning(
            "Lovelace is not loaded, so the dashboard resource could not be registered automatically. "
            "Add %s as a JavaScript module resource manually.",
            RESOURCE_URL,
        )
        return

    resources = lovelace.resources
    if not isinstance(resources, ResourceStorageCollection):
        _LOGGER.info(
            "Lovelace resources are YAML-managed. Add %s as a module resource to your Lovelace YAML.",
            RESOURCE_URL,
        )
        return

    await resources.async_get_info()
    existing = next(
        (
            item
            for item in resources.async_items()
            if str(item.get(CONF_URL, "")).split("?", 1)[0] == RESOURCE_PATH
        ),
        None,
    )

    if existing is None:
        await resources.async_create_item(
            {CONF_RESOURCE_TYPE_WS: "module", CONF_URL: RESOURCE_URL}
        )
        _LOGGER.info("Registered Music Assistant Dashboard Lovelace resource")
        return

    if existing.get(CONF_URL) != RESOURCE_URL:
        await resources.async_update_item(
            existing[CONF_ID],
            {CONF_RESOURCE_TYPE_WS: "module", CONF_URL: RESOURCE_URL},
        )
        _LOGGER.info("Updated Music Assistant Dashboard Lovelace resource to %s", RESOURCE_URL)
