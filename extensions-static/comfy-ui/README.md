# ComfyUI Prompt Studio Extension

This extension provides rich prompt input functionality for ComfyUI with advanced features like autocompletion, custom chants, and LoRA support.

## Features

- **Rich Prompt Editor**: Advanced text editor with syntax highlighting for prompts
- **Custom Chants**: Create reusable prompt templates with `@name` syntax
- **LoRA Support**: Integrated LoRA management and insertion
- **Autocompletion**: Intelligent tag suggestions based on Danbooru and other datasets
- **Settings Management**: Persistent settings across sessions with real-time synchronization
- **Local File Support**: Load custom dictionaries and data files securely
- **Multi-Client Synchronization**: Settings changes are automatically synchronized across all connected clients

## Installation

1. Copy this entire directory to your ComfyUI `custom_nodes` folder
2. Restart ComfyUI
3. The extension will be automatically loaded

## Usage

### Opening Prompt Studio

- **Keyboard Shortcut**: Press `Ctrl+Space` (or `Cmd+Space` on Mac) while focused on any text area
- The prompt studio will open as an overlay on top of ComfyUI

### Settings Storage

Settings are automatically saved to:

- `ComfyUI/user/default/ComfyUI-Prompt-Studio/settings/` (user-level settings)
- `ComfyUI/user/default/ComfyUI-Prompt-Studio/local_settings/` (local machine settings)
- `ComfyUI/user/default/ComfyUI-Prompt-Studio/server_settings/` (server-wide settings)

### Dictionary Files

Place custom dictionary files in:

- `ComfyUI/user/default/ComfyUI-Prompt-Studio/dictionaries/`

Supported file formats:

- `.csv` - Comma-separated values
- `.json` - JSON format
- `.txt` - Plain text (one entry per line)

### API Endpoints

The extension provides RESTful HTTP endpoints for prompt and settings management:

#### Prompt Management

- `GET /prompt-studio/prompts` - List all prompts
- `GET /prompt-studio/prompts/{name}` - Get specific prompt as raw text
- `PUT /prompt-studio/prompts/{name}` - Save/update prompt with raw text content
- `DELETE /prompt-studio/prompts/{name}` - Delete prompt by name

#### Settings Management

- `GET /prompt-studio/settings/{key}?level={level}` - Load settings
- `POST /prompt-studio/settings/{key}?level={level}&client_id={client_id}` - Save settings

#### Data & Health Check

- `GET /prompt-studio/data?type=file&source={filename}` - Fetch dictionary data
- `GET /prompt-studio/ready` - Health check endpoint

## Security

- **File Access**: Only files within the `dictionaries` directory can be accessed
- **Path Validation**: All file paths are validated to prevent directory traversal attacks
- **Settings Isolation**: Settings are stored in dedicated directories with proper validation

## Custom Chants

Create custom chants by defining them in the chants editor:

```text
@@quality
  /// High quality tags
  masterpiece, best quality, ultra detailed

@@character:girl
  /// Basic female character
  1girl, solo, looking at viewer
```

Use them in prompts with `@quality` or `@character:girl`.

## Development

The extension consists of:

- `__init__.py` - Main Python module with API endpoints
- `config.py` - Configuration settings for the extension
- `backend/` - Python backend logic for settings and data management
- `frontend/` - JavaScript files for the web interface
- `pyproject.toml` - Python package configuration

## Disclaimer

This project was developed by a web developer, not a Python programmer or AI engineer. While the extension aims to provide useful functionality for ComfyUI users, please be aware that:

- The Python backend implementation may not follow all Python best practices
- AI/ML integration aspects are implemented based on available documentation and community examples
- Contributions from experienced Python developers and AI engineers are welcome to improve the codebase

If you encounter issues or have suggestions for improvement, please feel free to contribute or provide feedback.

## Troubleshooting

- Check the ComfyUI console for error messages
- Ensure the `dictionaries` directory has proper permissions
- Verify that the required Python packages are installed

## License

This extension is part of the ComfyUI Prompt Studio project.
