"""
ComfyUI Prompt Studio Extension

This extension provides rich prompt input functionality for ComfyUI.
It offers APIs for settings storage and data fetching with appropriate security restrictions.
"""

import logging

from aiohttp import web
from server import PromptServer

from .backend.data_manager import DataManager
from .backend.file_storage import FileStorage
from .backend.settings import SettingsManager
from .config import (
    NODE_CLASS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS,
    WEB_DIRECTORY,
    Config,
)

logger = logging.getLogger(__name__)

# Get the routes decorator from PromptServer
routes = PromptServer.instance.routes


class ComfyUIPromptStudio:
    """Main class for ComfyUI Prompt Studio extension"""

    def __init__(self):
        self.server = PromptServer.instance
        self.config = Config()
        self.data_manager = DataManager(self.config.dictionaries_dir)
        self.file_storage = FileStorage(self.config.prompts_dir)
        self.settings_manager = SettingsManager(self.config.settings_dir, self.server)

        # Store references globally so route handlers can access them
        global data_manager, file_storage, settings_manager
        data_manager = self.data_manager
        file_storage = self.file_storage
        settings_manager = self.settings_manager

        logger.info("ComfyUI Prompt Studio initialized")


# Route handlers using ComfyUI's decorator pattern
@routes.get("/prompt-studio/settings/{key}")
async def load_settings_route(request):
    return await settings_manager.load_settings(request)


@routes.post("/prompt-studio/settings/{key}")
async def save_settings_route(request):
    return await settings_manager.save_settings(request)


@routes.get("/prompt-studio/data")
async def fetch_data_route(request):
    return await data_manager.fetch_data(request)


@routes.get("/prompt-studio/ready")
async def fetch_ready_status(_request):
    return web.Response(status=204)


# RESTful prompt management routes
@routes.get("/prompt-studio/prompts")
async def get_prompts_route(request):
    """GET /prompt-studio/prompts - List all prompts with optional search"""
    return await file_storage.get_prompts(request)


@routes.get("/prompt-studio/prompts/{name}")
async def get_prompt_route(request):
    """GET /prompt-studio/prompts/{name} - Get a specific prompt by name"""
    return await file_storage.get_prompt(request)


@routes.put("/prompt-studio/prompts/{name}")
async def save_prompt_route(request):
    """PUT /prompt-studio/prompts/{name} - Save/update a prompt by name"""
    return await file_storage.save_prompt(request)


@routes.delete("/prompt-studio/prompts/{name}")
async def delete_prompt_route(request):
    """DELETE /prompt-studio/prompts/{name} - Delete a prompt by name"""
    return await file_storage.delete_prompt(request)


# Initialize the extension when the module is imported
try:
    extension = ComfyUIPromptStudio()
    logger.info("ComfyUI Prompt Studio extension loaded successfully")
except Exception as e:
    logger.error(f"Failed to initialize ComfyUI Prompt Studio extension: {e}")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
