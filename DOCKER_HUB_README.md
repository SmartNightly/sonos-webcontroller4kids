# Sonos Web Controller 4 Kids

Kid-friendly web UI for controlling Sonos speakers, optimized for touchscreens (800×480 px). Children can browse and play albums and audiobooks from Apple Music. Admins configure rooms, volume limits, and UI templates via a built-in admin panel.

**Source and documentation:** [GitHub repository](https://github.com/SmartNightly/sonos-webcontroller4kids)

## Features

- Browse albums and audiobooks from Apple Music with cover art
- Artist profile photos (circular) fetched automatically from Apple Music
- Five UI themes: Default, Classic (Original), Colorful Kids, Hörinsel, and Wolkenklang (Pink & Lila)
- Kids cycle through parent-approved themes by clicking the theme name; no selection menu
- Home button returns to the start view without interrupting playback
- Uniform album tiles with two reserved title lines and accessible full titles
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

### Kids' controls

- **Home icon, top left:** Returns directly from an artist or album to the start view and resets the media filter to “Alles” (All). The selected room, theme, and current playback are preserved, without reloading the page.
- **Theme name next to Home:** Each click advances to the next allowed theme; the last wraps back to the first. With only one allowed theme, the name is not clickable. The choice is saved in that browser, not as the installation-wide default.
- **Back:** Returns one level, for example from an album's details to the artist's albums.
- **Album titles:** All themes reserve two lines, including for short titles. Longer titles end with “…”; full titles remain available in album details and to screen readers. The title area's height scales with its font size.

Home and theme switching support keyboard input and visible focus indicators. Hovering over the theme name does not underline it.

### Theme permissions

Open the admin panel (`?admin=1`), then **Einstellungen → Design der Kinderansicht**:

1. Use the upper theme buttons to choose the default for new browsers. Choosing a default also enables that theme.
2. Under **Für Kinder freigegebene Themes**, check all designs the children may use.
3. Click **Theme-Freigaben speichern** to save the allowed selection.

At least one theme must remain enabled. If the default is removed, the first remaining
theme in the saved list becomes the new default. While the backend is reachable,
open kids' views refresh permissions every 30 seconds and when the browser window
regains focus. A saved browser preference is only restored if it is still allowed.

Existing installations initially keep only their previous theme enabled. Enable
additional themes explicitly in the admin panel after updating.

| Theme | Configuration ID |
| --- | --- |
| Default (updated dark theme) | `default` |
| Classic (original Default kids' view) | `classic` |
| Colorful Kids | `colorful` |
| Hörinsel | `hoerinsel` |
| Wolkenklang (Pink & Lila) | `wolkenklang` |

### Persistent data

Mount a `media-data/` directory containing:

| File | Purpose |
|------|---------|
| `config.json` | Sonos API URL, rooms, volume limits, default theme, allowed themes |
| `media.json` | Media library (albums, audiobooks, tracks) |

An empty directory can be used for initial setup. Use the admin panel to save
configuration and add media. Back up this directory before replacing an installation.

Example `config.json`:

```json
{
  "sonosBaseUrl": "http://192.168.1.x:5005",
  "rooms": ["Living Room", "Kids Room"],
  "enabledRooms": ["Kids Room"],
  "activeTemplate": "default",
  "enabledTemplates": ["default", "hoerinsel", "wolkenklang"]
}
```

`activeTemplate` is the installation's default; `enabledTemplates` controls which
themes kids can cycle through. If `enabledTemplates` is absent in an older file,
only the current default is offered. Personal theme choices are stored in the
browser and do not change these settings. Prefer the admin panel for updates;
restart the backend after manually editing JSON files because it caches them in memory.

The admin panel has no authentication. Use this controller only on a trusted local
network; do not expose it directly to the internet.

## Requirements

- Sonos speakers on the local network
- [node-sonos-http-api](https://github.com/jishi/node-sonos-http-api) running and accessible
- Apple Music configured in the Sonos app (for Apple Music playback)

## Architecture

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express 5 + Node.js + TypeScript (port 3344)
- **Data**: JSON files in `/app/media-data` (no database required)
- **Multi-arch**: `linux/amd64` + `linux/arm64`
