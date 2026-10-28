"""Music Assistant Dashboard companion integration."""

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_MUSIC_ASSISTANT_ENTRY_ID, DATA_ENTRIES, DOMAIN
from .frontend import async_register_frontend
from .http import async_register_http
from .websocket import async_register_websocket


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Music Assistant Dashboard from a config entry."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    entries = domain_data.setdefault(DATA_ENTRIES, {})
    entries[entry.entry_id] = entry.data[CONF_MUSIC_ASSISTANT_ENTRY_ID]

    async_register_websocket(hass)
    async_register_http(hass)
    await async_register_frontend(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Music Assistant Dashboard config entry."""
    domain_data = hass.data.get(DOMAIN, {})
    entries = domain_data.get(DATA_ENTRIES, {})
    entries.pop(entry.entry_id, None)
    return True
