"""Authenticated Home Assistant WebSocket bridge for Music Assistant Dashboard."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.music_assistant.helpers import get_music_assistant_client
from homeassistant.core import HomeAssistant, callback

from .const import DATA_ENTRIES, DATA_WS_REGISTERED, DOMAIN


COMMANDS: dict[str, tuple[str, set[str], set[str]]] = {
    "play_pause": ("player_queues/play_pause", {"queue_id"}, set()),
    "next": ("player_queues/next", {"queue_id"}, set()),
    "previous": ("player_queues/previous", {"queue_id"}, set()),
    "seek": ("player_queues/seek", {"queue_id", "position"}, set()),
    "shuffle": ("player_queues/shuffle", {"queue_id", "shuffle_enabled"}, set()),
    "repeat": ("player_queues/repeat", {"queue_id", "repeat_mode"}, set()),
    "play_index": ("player_queues/play_index", {"queue_id", "index"}, {"seek_position", "fade_in"}),
    "move_item": ("player_queues/move_item", {"queue_id", "queue_item_id"}, {"pos_shift"}),
    "delete_item": ("player_queues/delete_item", {"queue_id", "item_id_or_index"}, set()),
    "clear": ("player_queues/clear", {"queue_id"}, set()),
    "volume_set": ("players/cmd/volume_set", {"player_id", "volume_level"}, set()),
    "group": ("players/cmd/group", {"player_id", "target_player"}, set()),
    "ungroup": ("players/cmd/ungroup", {"player_id"}, set()),
    "group_many": ("players/cmd/group_many", {"target_player", "child_player_ids"}, set()),
    "ungroup_many": ("players/cmd/ungroup_many", {"player_ids"}, set()),
    "transfer": ("player_queues/transfer", {"source_queue_id", "target_queue_id"}, {"auto_play"}),
}


def _get_mass(hass: HomeAssistant):
    domain_data = hass.data.get(DOMAIN, {})
    entries = domain_data.get(DATA_ENTRIES, {})
    if not entries:
        raise RuntimeError("Music Assistant Dashboard is not configured")
    music_assistant_entry_id = next(iter(entries.values()))
    return get_music_assistant_client(hass, music_assistant_entry_id)


def _send_error(connection, msg: dict[str, Any], err: Exception) -> None:
    connection.send_error(msg["id"], "music_assistant_dashboard_error", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/info"})
@websocket_api.async_response
async def websocket_info(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    try:
        mass = _get_mass(hass)
        info = mass.server_info
        connection.send_result(
            msg["id"],
            {
                "server_id": info.server_id if info else None,
                "server_version": info.server_version if info else None,
                "schema_version": info.schema_version if info else None,
                "base_url": info.base_url if info else None,
            },
        )
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/players"})
@websocket_api.async_response
async def websocket_players(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    try:
        result = await _get_mass(hass).send_command("players/all")
        connection.send_result(msg["id"], result)
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/queues"})
@websocket_api.async_response
async def websocket_queues(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    try:
        result = await _get_mass(hass).send_command("player_queues/all")
        connection.send_result(msg["id"], result)
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg, err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/queue_items",
        vol.Required("queue_id"): str,
        vol.Optional("limit", default=500): int,
        vol.Optional("offset", default=0): int,
    }
)
@websocket_api.async_response
async def websocket_queue_items(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    try:
        result = await _get_mass(hass).send_command(
            "player_queues/items",
            queue_id=msg["queue_id"],
            limit=msg["limit"],
            offset=msg["offset"],
        )
        connection.send_result(msg["id"], result)
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg, err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/command",
        vol.Required("action"): vol.In(COMMANDS),
        vol.Optional("args", default={}): dict,
    }
)
@websocket_api.async_response
async def websocket_command(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    try:
        action = msg["action"]
        args = dict(msg["args"])
        command, required, optional = COMMANDS[action]
        missing = required - args.keys()
        unknown = args.keys() - required - optional
        if missing:
            raise ValueError(f"Missing arguments for {action}: {', '.join(sorted(missing))}")
        if unknown:
            raise ValueError(f"Unsupported arguments for {action}: {', '.join(sorted(unknown))}")
        result = await _get_mass(hass).send_command(command, **args)
        connection.send_result(msg["id"], result)
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg, err)


@callback
def async_register_websocket(hass: HomeAssistant) -> None:
    """Register dashboard bridge commands once per Home Assistant process."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_WS_REGISTERED):
        return
    websocket_api.async_register_command(hass, websocket_info)
    websocket_api.async_register_command(hass, websocket_players)
    websocket_api.async_register_command(hass, websocket_queues)
    websocket_api.async_register_command(hass, websocket_queue_items)
    websocket_api.async_register_command(hass, websocket_command)
    domain_data[DATA_WS_REGISTERED] = True
