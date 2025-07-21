"""
Utility functions for path validation and security
"""

import re
from pathlib import Path
from typing import Optional


def is_valid_key(key: str) -> bool:
    """Check if settings key is valid with strict validation rules"""
    if not key:
        return False

    # Check if key starts or ends with dot
    if key.startswith(".") or key.endswith("."):
        return False

    # Check for consecutive dots
    if ".." in key:
        return False

    # Allow alphanumeric, hyphens, underscores, and dots
    return bool(re.match(r"^[a-zA-Z0-9._-]+$", key))


def get_safe_dictionary_path(source: str, dictionaries_dir: Path) -> Optional[Path]:
    """Get safe path for dictionary file (only allows files in dictionaries directory)"""
    try:
        # Normalize the source path
        source_path = Path(source).resolve()

        # Check if the requested path is within the dictionaries directory
        dictionaries_path = dictionaries_dir.resolve()

        # Construct the full path
        if source_path.is_absolute():
            # If absolute path, check if it's within dictionaries directory
            full_path = source_path
        else:
            # If relative path, resolve relative to dictionaries directory
            full_path = (dictionaries_path / source).resolve()

        # Security check: ensure the resolved path is within dictionaries directory
        try:
            full_path.relative_to(dictionaries_path)
        except ValueError:
            # Path is outside dictionaries directory
            return None

        return full_path

    except Exception:
        return None


def get_settings_path(key: str, level: str, settings_dir: Path) -> Path:
    """Get the file path for a settings key"""
    filename = f"{level}.{key}.json"
    return settings_dir / filename
