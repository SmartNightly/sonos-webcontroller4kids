# Sonos Web Controller 4 Kids

Kid-friendly web UI for controlling Sonos speakers, optimized for touchscreens (800×480 px). Children can browse and play albums and audiobooks from Apple Music. Admins configure rooms, volume limits, and UI templates via a built-in admin panel.

**GitHub**: https://github.com/SmartNightly/sonos-webcontroller4kids

## Features

- Browse albums and audiobooks from Apple Music with cover art
- Artist profile photos (circular) fetched automatically from Apple Music
- Multiple UI templates: classic default + colorful kids theme
- Room selection with per-room volume limits
- Admin panel for media library management and Sonos configuration
- Optimized for touch screens (800×480 px)
- Multi-arch: `linux/amd64` + `linux/arm64` (Raspberry Pi, Synology NAS, etc.)

## Quick Start

```bash
docker run -d \
  --name sonos-webcontroller4kids \
  -v /path/to/media-data:/app/media-data \
  -p 3344:3344 \
  smartnightly/sonos-webcontroller4kids:latest
```

Access the app at `http://your-host:3344`
Access the admin panel at `http://your-host:3344?admin=1`

## Docker Compose

```yaml
services:
  sonos-webcontroller:
    image: smartnightly/sonos-webcontroller4kids:latest
    container_name: sonos-webcontroller4kids
    volumes:
      - ./media-data:/app/media-data
    ports:
      - "3344:3344"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

## Configuration

Mount a `media-data/` directory containing:

| File | Purpose |
|------|---------|
| `config.json` | Sonos API URL, rooms, volume limits, active template |
| `media.json` | Media library (albums, audiobooks, tracks) |

Both files are created automatically on first run with defaults.

Example `config.json`:
```json
{
  "sonosBaseUrl": "http://192.168.1.x:5005",
  "rooms": ["Living Room", "Kids Room"],
  "enabledRooms": ["Kids Room"],
  "activeTemplate": "default"
}
```

## Requirements

- Sonos speakers on the local network
- [node-sonos-http-api](https://github.com/jishi/node-sonos-http-api) running and accessible
- Apple Music configured in the Sonos app (for Apple Music playback)

## Architecture

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express 5 + Node.js + TypeScript (port 3344)
- **Data**: JSON files in `/app/media-data` (no database required)
- **Multi-arch**: `linux/amd64` + `linux/arm64`
