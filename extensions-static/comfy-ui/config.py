"""
Configuration and logging setup for ComfyUI Prompt Studio
"""

import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WEB_DIRECTORY = "./frontend"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}


class Config:
    """Configuration class for ComfyUI Prompt Studio"""

    def __init__(self):
        # Define safe directories
        self.comfyui_dir = Path(__file__).parent.parent.parent  # ComfyUI root
        self.user_dir = self.comfyui_dir / "user" / "default"
        self.extension_dir = self.user_dir / "ComfyUI-Prompt-Studio"

        self.dictionaries_dir = self.extension_dir / "dictionaries"
        self.prompts_dir = self.extension_dir / "prompts"
        self.settings_dir = self.extension_dir / "settings"

        # Ensure directories exist
        self.dictionaries_dir.mkdir(parents=True, exist_ok=True)
        self.prompts_dir.mkdir(parents=True, exist_ok=True)
        self.settings_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Dictionaries directory: {self.dictionaries_dir}")
        logger.info(f"Prompts directory: {self.prompts_dir}")
        logger.info(f"Settings directory: {self.settings_dir}")
