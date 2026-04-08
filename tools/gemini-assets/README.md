# Gemini Assets MCP Server

A local Model Context Protocol (MCP) server that generates and revises game art assets using the Google Gemini image generation API.

## Setup

1. Copy `.env.example` to `.env` and fill in your key:
   ```
   cp .env.example .env
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build (for production):
   ```
   npm run build
   npm start
   ```

   Or run directly in dev mode:
   ```
   npm run dev
   ```

## Registering with Claude Code

Add this to your Claude Code MCP settings (`.claude/settings.json` or via the UI):

```json
{
  "mcpServers": {
    "gemini-assets": {
      "command": "node",
      "args": ["tools/gemini-assets/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "<your key>"
      }
    }
  }
}
```

Or using dev mode with `tsx`:
```json
{
  "mcpServers": {
    "gemini-assets": {
      "command": "npx",
      "args": ["tsx", "tools/gemini-assets/src/index.ts"]
    }
  }
}
```

## Tools

### `generate_styleframe(prompt, outPath)`

Generates a full scene / mood reference image.

- **prompt** — detailed description of the desired scene
- **outPath** — output path relative to project root (e.g. `assets/styleframes/title.png`)

### `generate_sprite(prompt, outPath)`

Generates a sprite image (player, enemy, boss, pickup, VFX, etc.) on a transparent background.

- **prompt** — detailed description of the sprite
- **outPath** — output path (e.g. `assets/sprites/player.png`)

### `revise_image(prompt, inputPath, outPath)`

Edits an existing image based on an instruction prompt.

- **prompt** — what to change
- **inputPath** — path to the existing image
- **outPath** — path for the revised output

## Default Model

`gemini-3-pro-image-preview`

To change it, edit the `MODEL` constant in `src/index.ts`.
