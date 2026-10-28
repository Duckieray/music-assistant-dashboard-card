"""Config flow for Music Assistant Dashboard."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries

from .const import CONF_MUSIC_ASSISTANT_ENTRY_ID, DOMAIN


class MusicAssistantDashboardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Configure the companion bridge to an existing Music Assistant integration."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Create the singleton dashboard bridge."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        mass_entries = self.hass.config_entries.async_entries("music_assistant")
        if not mass_entries:
            return self.async_abort(reason="music_assistant_not_found")

        if user_input is not None:
            selected = user_input[CONF_MUSIC_ASSISTANT_ENTRY_ID]
            entry = next((item for item in mass_entries if item.entry_id == selected), None)
            if entry is None:
                return self.async_abort(reason="music_assistant_not_found")
            return self.async_create_entry(
                title="Music Assistant Dashboard",
                data={CONF_MUSIC_ASSISTANT_ENTRY_ID: entry.entry_id},
            )

        if len(mass_entries) == 1:
            return self.async_create_entry(
                title="Music Assistant Dashboard",
                data={CONF_MUSIC_ASSISTANT_ENTRY_ID: mass_entries[0].entry_id},
            )

        choices = {entry.entry_id: entry.title for entry in mass_entries}
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {vol.Required(CONF_MUSIC_ASSISTANT_ENTRY_ID): vol.In(choices)}
            ),
        )
