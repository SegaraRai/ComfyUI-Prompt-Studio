"""
Dictionary and data management functionality
"""

import json
import logging
import re
from pathlib import Path
from urllib.parse import unquote

from aiohttp import web

from .utils import get_safe_dictionary_path

logger = logging.getLogger(__name__)


class DataManager:
    """Handles data fetching and dictionary management"""

    def __init__(self, dictionaries_dir: Path):
        self.dictionaries_dir = dictionaries_dir

    async def fetch_data(self, request):
        """Fetch data from local files (restricted to dictionaries directory)"""
        try:
            source_type = request.query.get("type", "file")
            source = request.query.get("source", "")

            if source_type != "file":
                return web.Response(status=400, text="Only file sources are supported")

            if not source:
                return web.Response(status=400, text="Source parameter is required")

            # Security check: only allow files in dictionaries directory
            file_path = get_safe_dictionary_path(source, self.dictionaries_dir)
            if not file_path:
                return web.Response(
                    status=403, text="Access denied: file outside allowed directory"
                )

            if not file_path.exists():
                return web.Response(status=404, text="File not found")

            with open(file_path, "r", encoding="utf-8") as f:
                data = f.read()

            return web.Response(text=data, content_type="text/plain")

        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            return web.Response(status=500, text=f"Error fetching data: {str(e)}")
