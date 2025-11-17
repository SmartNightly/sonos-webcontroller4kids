# Sonos Web Controller 4 Kids

Ein kinderfreundlicher Web-Controller für Sonos-Lautsprecher mit Touchscreen-optimierter Oberfläche (800×480px).

## Features

- 🎵 **Kinderfreundliche UI** - Optimiert für 5" Touchscreen (800×480px)
- 🎨 **Raumsymbole** - Emoji-Icons für bessere Orientierung
- 📚 **Apple Music Integration** - Alben und Hörbücher direkt hinzufügen
- 🎯 **Track-Navigation** - Einzelne Tracks aus Alben abspielen
- 🔀 **Filter** - Nach Musik/Hörbücher filtern
- 🔄 **Auto-Updates** - Automatisches Docker Image Building via GitHub Actions

## Quick Start mit Docker

### Voraussetzungen

- Docker & Docker Compose (oder Portainer)
- Sonos HTTP API läuft (z.B. `http://192.168.114.21:5005`)
- Synology NAS oder Linux Server

### Deployment mit Portainer

1. **In Portainer → Stacks → Add stack**
2. **Name:** `sonos-webcontroller4kids`
3. **Web editor - Kopiere folgenden Code:**

```yaml
version: '3.8'

services:
  sonos-webcontroller:
    image: smartnightly/sonos-webcontroller4kids:latest
    container_name: sonos-webcontroller4kids
    
    # Ändere hier den Port direkt (Format: "host-port:container-port")
    ports:
      - "3344:3344"  # z.B. "8080:8080" für Port 8080
    
    volumes:
      # Passe den Pfad an deine Synology-Struktur an
      - /volume1/docker/sonos-webcontroller4kids/media-data:/app/media-data
    
    restart: unless-stopped
    
    environment:
      - NODE_ENV=production
      - PORT=3344  # Muss mit container-port oben übereinstimmen
```

4. **Passe den Volume-Pfad an** (z.B. `/volume1/docker/...`)
5. **Optional: Ändere beide Port-Werte** (in `ports:` und `PORT=`)
6. **Deploy the stack**
7. **Zugriff:** `http://synology-ip:3344` (oder dein konfigurierter Port)

**Port ändern:** Einfach beide Werte im Stack-Editor anpassen:
- `ports: - "8080:8080"` 
- `PORT=8080`

### Deployment mit Docker Compose

```bash
# docker-compose.yml verwenden
docker-compose -f docker-compose.portainer.yml up -d
```

## Updates

Das Docker Image wird automatisch bei jedem Push auf `main` gebaut und auf [Docker Hub](https://hub.docker.com/r/smartnightly/sonos-webcontroller4kids) veröffentlicht.

**In Portainer:** Einfach "Pull and redeploy" klicken

**Mit Docker Compose:**
```bash
docker-compose pull
docker-compose up -d
```

## Development

### Lokale Entwicklung

```bash
# Backend
cd backend
npm install
npm run dev  # läuft auf Port 3344

# Frontend (in neuem Terminal)
cd frontend
npm install
npm run dev  # läuft auf Port 5173
```

Backend: `http://localhost:3344`  
Frontend: `http://localhost:5173` (Proxy zu Backend)

### Lokales Docker Build

```bash
docker build -t sonos-webcontroller4kids:latest .
docker run -p 3344:3344 -v ./media-data:/app/media-data sonos-webcontroller4kids:latest

# Mit eigenem Port:
# PORT=8080 docker run -p 8080:8080 -e PORT=8080 -v ./media-data:/app/media-data sonos-webcontroller4kids:latest
```

## Konfiguration

### Port-Konfiguration

Der Port kann über die Umgebungsvariable `PORT` angepasst werden:

- **Standard:** 3344
- **Docker Compose:** Setze `PORT=8080` in der `.env` Datei oder direkt in `docker-compose.yml`
- **Portainer:** Setze `PORT=8080` unter "Environment variables"

### Admin-Interface

Die Konfiguration erfolgt über das Admin-Interface unter `http://your-ip:3344?admin=1`.

### Wichtige Einstellungen:

- **Sonos Base URL:** URL zur Sonos HTTP API
- **Räume:** Verfügbare Sonos-Räume
- **Raumsymbole:** Emoji-Icons für Räume
- **Shuffle/Repeat:** Anzeige aktivieren/deaktivieren

## Dokumentation

- [Docker Deployment Guide](DEPLOYMENT.md) - Ausführliche Deployment-Anleitung
- [Docker Setup](DOCKER.md) - Docker-Grundlagen
- [GitHub Actions Setup](.github/SETUP.md) - CI/CD Konfiguration

## Technologie-Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + TypeScript
- **Deployment:** Docker + GitHub Actions
- **API:** iTunes Search API, Sonos HTTP API

## Lizenz

MIT

