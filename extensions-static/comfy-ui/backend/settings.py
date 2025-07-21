"""
Settings management functionality
"""

import json
import logging
import time
from pathlib import Path

from aiohttp import web
from server import PromptServer

from .utils import is_valid_key, get_settings_path

logger = logging.getLogger(__name__)


class SettingsManager:
    """Handles settings storage and retrieval"""

    def __init__(self, settings_dir: Path, server: PromptServer):
        self.settings_dir = settings_dir
        self.server = server

    async def load_settings(self, request):
        """Load settings from JSON file"""
        try:
            key = request.match_info["key"]
            level = request.query.get("level", "user")

            if not is_valid_key(key):
                return web.Response(status=400, text="Invalid key format")

            if not is_valid_key(level):
                return web.Response(status=400, text="Invalid level format")

            file_path = get_settings_path(key, level, self.settings_dir)

            if not file_path.exists():
                return web.Response(status=404, text="Settings not found")

            with open(file_path, "r", encoding="utf-8") as f:
                data = f.read()

            return web.Response(text=data, content_type="application/json")

        except Exception as e:
            logger.error(f"Error loading settings: {e}")
            return web.Response(status=500, text=f"Error loading settings: {str(e)}")

    async def save_settings(self, request):
        """Save settings to JSON file"""
        try:
            key = request.match_info["key"]
            level = request.query.get("level", "user")
            client_id = request.query.get("client_id", "")

            if not is_valid_key(key):
                return web.Response(status=400, text="Invalid key format")

            if not is_valid_key(level):
                return web.Response(status=400, text="Invalid level format")

            if not client_id:
                return web.Response(status=400, text="Client ID is required")

            data = await request.text()

            # Validate JSON
            try:
                json.loads(data)
            except json.JSONDecodeError:
                return web.Response(status=400, text="Invalid JSON data")

            file_path = get_settings_path(key, level, self.settings_dir)

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(data)

            # Notify all clients about the settings update
            await self._notify_settings_update(client_id, key, level)

            return web.Response(text="Settings saved successfully")

        except Exception as e:
            logger.error(f"Error saving settings: {e}")
            return web.Response(status=500, text=f"Error saving settings: {str(e)}")

    async def _notify_settings_update(self, client_id: str, key: str, level: str):
        """Notify all connected clients about settings update"""
        try:
            # Create notification message
            notification = {
                "client_id": client_id,
                "key": key,
                "level": level,
                "timestamp": int(time.time() * 1000),  # milliseconds
            }

            # Send notification to all connected clients via PromptServer
            await self.server.send_json("cps-settings-update", notification)

            logger.debug(
                f"Notified clients about settings update: {key} (level: {level}, client: {client_id})"
            )

        except Exception as e:
            logger.error(f"Failed to notify clients about settings update: {e}")
