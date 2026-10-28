"""Authenticated Home Assistant WebSocket bridge for Music Assistant Dashboard."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.music_assistant.helpers import get_music_assistant_client
from homeassistant.core import HomeAssistant, callback

from .const import DATA_ENTRIES, DATA_WS_REGISTERED, DOMAIN


MUSIC_ASSISTANT_DOMAIN = "music_assistant"
LIBRARY_COMMANDS = {
    "album": "music/albums/library_items",
    "artist": "music/artists/library_items",
    "track": "music/tracks/library_items",
    "playlist": "music/playlists/library_items",
    "radio": "music/radios/library_items",
}
SEARCH_MEDIA_TYPES = ["artist", "album", "track", "playlist", "radio"]
RECENT_MEDIA_TYPES = ["track", "album", "playlist", "radio"]

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
    "play_media": (
        "player_queues/play_media",
        {"queue_id", "media"},
        {"option", "radio_mode", "start_item"},
    ),
    "volume_set": ("players/cmd/volume_set", {"player_id", "volume_level"}, set()),
    "group": ("players/cmd/group", {"player_id", "target_player"}, set()),
    "ungroup": ("players/cmd/ungroup", {"player_id"}, set()),
    "group_many": ("players/cmd/group_many", {"target_player", "child_player_ids"}, set()),
    "ungroup_many": ("players/cmd/ungroup_many", {"player_ids"}, set()),
    "set_members": (
        "players/cmd/set_members",
        {"target_player"},
        {"player_ids_to_add", "player_ids_to_remove"},
    ),
    "transfer": ("player_queues/transfer", {"source_queue_id", "target_queue_id"}, {"auto_play"}),
}


def _get_mass_entry_id(hass: HomeAssistant) -> str:
    domain_data = hass.data.get(DOMAIN, {})
    entries = domain_data.get(DATA_ENTRIES, {})
    if not entries:
        raise RuntimeError("Music Assistant Dashboard is not configured")
    return next(iter(entries.values()))


def _get_mass(hass: HomeAssistant):
    return get_music_assistant_client(hass, _get_mass_entry_id(hass))


async def _call_mass_action(
    hass: HomeAssistant,
    action: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    """Call the public Home Assistant Music Assistant action and return its response."""
    response = await hass.services.async_call(
        MUSIC_ASSISTANT_DOMAIN,
        action,
        data,
        blocking=True,
        return_response=True,
    )
    if response is None:
        return {}
    if not isinstance(response, dict):
        raise RuntimeError(f"Unexpected Music Assistant {action} response: {type(response).__name__}")
    return response


def _send_error(connection, msg: dict[str, Any], err: Exception) -> None:
    detail = str(err) or repr(err)
    connection.send_error(
        msg["id"],
        "music_assistant_dashboard_error",
        f"{type(err).__name__}: {detail}",
    )


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
        vol.Required("type"): f"{DOMAIN}/library",
        vol.Required("media_type"): vol.In(LIBRARY_COMMANDS),
        vol.Optional("limit", default=30): int,
        vol.Optional("offset", default=0): int,
        vol.Optional("favorite"): bool,
        vol.Optional("search"): str,
    }
)
@websocket_api.async_response
async def websocket_library(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Return library items, preferring HA's stable action surface."""
    args: dict[str, Any] = {"limit": msg["limit"], "offset": msg["offset"]}
    if "favorite" in msg:
        args["favorite"] = msg["favorite"]
    if "search" in msg:
        args["search"] = msg["search"]

    try:
        try:
            response = await _call_mass_action(
                hass,
                "get_library",
                {
                    "config_entry_id": _get_mass_entry_id(hass),
                    "media_type": msg["media_type"],
                    **args,
                },
            )
            items = response.get("items", [])
            if not isinstance(items, list):
                raise RuntimeError("Music Assistant get_library returned an invalid items payload")
            connection.send_result(msg["id"], items)
            return
        except Exception as action_err:  # noqa: BLE001
            try:
                result = await _get_mass(hass).send_command(
                    LIBRARY_COMMANDS[msg["media_type"]],
                    **args,
                )
                connection.send_result(msg["id"], result)
                return
            except Exception as direct_err:  # noqa: BLE001
                raise RuntimeError(
                    "Library request failed through both Home Assistant and direct Music Assistant paths. "
                    f"HA: {type(action_err).__name__}: {action_err}; "
                    f"MA: {type(direct_err).__name__}: {direct_err}"
                ) from direct_err
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg, err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/search",
        vol.Required("query"): str,
        vol.Optional("limit", default=12): int,
        vol.Optional("library_only", default=False): bool,
    }
)
@websocket_api.async_response
async def websocket_search(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Search, preferring HA's stable action surface with a direct MA fallback."""
    try:
        try:
            response = await _call_mass_action(
                hass,
                "search",
                {
                    "config_entry_id": _get_mass_entry_id(hass),
                    "name": msg["query"],
                    "media_type": SEARCH_MEDIA_TYPES,
                    "limit": msg["limit"],
                    "library_only": msg["library_only"],
                },
            )
            connection.send_result(msg["id"], response)
            return
        except Exception as action_err:  # noqa: BLE001
            try:
                result = await _get_mass(hass).send_command(
                    "music/search",
                    search_query=msg["query"],
                    media_types=SEARCH_MEDIA_TYPES,
                    limit=msg["limit"],
                    library_only=msg["library_only"],
                )
                connection.send_result(msg["id"], result)
                return
            except Exception as direct_err:  # noqa: BLE001
                raise RuntimeError(
                    "Search failed through both Home Assistant and direct Music Assistant paths. "
                    f"HA: {type(action_err).__name__}: {action_err}; "
                    f"MA: {type(direct_err).__name__}: {direct_err}"
                ) from direct_err
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg, err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/recently_played",
        vol.Optional("limit", default=12): int,
    }
)
@websocket_api.async_response
async def websocket_recently_played(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    try:
        result = await _get_mass(hass).send_command(
            "music/recently_played_items",
            limit=msg["limit"],
            media_types=RECENT_MEDIA_TYPES,
            fully_played_only=False,
            user_initiated_only=True,
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
    websocket_api.async_register_command(hass, websocket_library)
    websocket_api.async_register_command(hass, websocket_search)
    websocket_api.async_register_command(hass, websocket_recently_played)
    websocket_api.async_register_command(hass, websocket_command)
    domain_data[DATA_WS_REGISTERED] = True
