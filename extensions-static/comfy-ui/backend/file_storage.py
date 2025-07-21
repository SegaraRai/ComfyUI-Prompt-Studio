"""
File Storage Module for ComfyUI Backend
"""

import json
import logging
import re
from pathlib import Path

from aiohttp import web

logger = logging.getLogger(__name__)


class FileStorage:
    """Handles file storage and retrieval for prompts"""

    def __init__(self, prompts_dir: Path):
        self.prompts_dir = prompts_dir

    def _is_valid_filename(self, filename: str) -> bool:
        """Validate filename: up to 64 chars, alphanumeric + _ - . and non-ASCII"""
        if not filename or len(filename) > 64:
            return False

        # Do not start or end with a dot
        if filename.startswith(".") or filename.endswith("."):
            return False

        # No consecutive dots
        if ".." in filename:
            return False

        # Allow alphanumeric, underscore, hyphen, dot, and non-ASCII characters
        # Disallow path separators and other problematic characters
        if re.search(r'[/\\:<>"|?*]', filename):
            return False

        return True

    async def save_prompt(self, request):
        """Save prompt to file (PUT /prompts/{name}?overwrite=true)"""
        try:
            name = request.match_info["name"]
            overwrite = request.query.get("overwrite", "false").lower() == "true"

            if not self._is_valid_filename(name):
                return web.Response(
                    status=400,
                    text="Invalid filename: must be 1-64 characters, alphanumeric + _ - . and non-ASCII only",
                )

            data = await request.text()
            content = data

            # Ensure .txt extension
            filename = name if name.endswith(".txt") else f"{name}.txt"
            file_path = self.prompts_dir / filename

            if file_path.exists() and not overwrite:
                return web.Response(
                    status=409,
                    text="File already exists. Use ?overwrite=true to overwrite.",
                )

            # Write the prompt file
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)

            logger.info(f"Saved prompt file: {filename}")
            return web.Response(text=content, content_type="text/plain")

        except Exception as e:
            logger.error(f"Error saving prompt: {e}")
            return web.Response(status=500, text=f"Error saving prompt: {str(e)}")

    async def get_prompt(self, request):
        """Get prompt by name (GET /prompts/{name})"""
        try:
            name = request.match_info["name"]

            if not self._is_valid_filename(name):
                return web.Response(status=400, text="Invalid filename")

            # Ensure .txt extension
            filename = name if name.endswith(".txt") else f"{name}.txt"
            file_path = self.prompts_dir / filename

            if not file_path.exists():
                return web.Response(status=404, text="Prompt file not found")

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Return raw text content
            return web.Response(text=content, content_type="text/plain")

        except Exception as e:
            logger.error(f"Error loading prompt: {e}")
            return web.Response(status=500, text=f"Error loading prompt: {str(e)}")

    async def get_prompts(self, request):
        """List all saved prompt files (GET /prompts)"""
        try:
            prompt_files = []
            for file_path in self.prompts_dir.glob("*.txt"):
                filename = file_path.stem  # Remove .txt extension

                # Get file modification time
                mtime = file_path.stat().st_mtime

                prompt_files.append(
                    {
                        "name": filename,
                        "modified": mtime,
                    }
                )

            # Sort by modification time (newest first)
            prompt_files.sort(key=lambda x: x["modified"], reverse=True)

            return web.Response(
                text=json.dumps(prompt_files),
                content_type="application/json",
            )

        except Exception as e:
            logger.error(f"Error listing prompts: {e}")
            return web.Response(status=500, text=f"Error listing prompts: {str(e)}")

    async def delete_prompt(self, request):
        """Delete prompt file (DELETE /prompts/{name})"""
        try:
            name = request.match_info["name"]

            if not self._is_valid_filename(name):
                return web.Response(status=400, text="Invalid filename")

            # Ensure .txt extension
            filename = name if name.endswith(".txt") else f"{name}.txt"
            file_path = self.prompts_dir / filename

            if not file_path.exists():
                return web.Response(status=404, text="Prompt file not found")

            file_path.unlink()
            logger.info(f"Deleted prompt file: {filename}")

            return web.Response(status=204)  # No Content for successful DELETE

        except Exception as e:
            logger.error(f"Error deleting prompt: {e}")
            return web.Response(status=500, text=f"Error deleting prompt: {str(e)}")
