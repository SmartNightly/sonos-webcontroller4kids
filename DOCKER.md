# Sonos Web Controller 4 Kids - Docker Deployment

## Quick Start

### Mit Docker Compose (empfohlen)

```bash
# Container bauen und starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Container stoppen
docker-compose down
```

Die App läuft dann auf `http://localhost:3001`

### Mit Docker direkt

```bash
# Image bauen
docker build -t sonos-webcontroller4kids .

# Container starten
docker run -d \
  --name sonos-webcontroller \
  --network host \
  -v $(pwd)/media-data:/app/media-data \
  -p 3001:3001 \
  sonos-webcontroller4kids

# Logs anzeigen
docker logs -f sonos-webcontroller

# Container stoppen
docker stop sonos-webcontroller
docker rm sonos-webcontroller
```

## Konfiguration

Die `media-data` Ordner wird als Volume gemountet, sodass:
- `media.json` - Deine Medien-Bibliothek persistent bleibt
- `config.json` - Sonos-Konfiguration erhalten bleibt

## Network Mode

Der Container verwendet `network_mode: host` um direkten Zugriff auf Sonos-Geräte im lokalen Netzwerk zu haben.

## Development vs Production

- **Development**: `npm run dev` startet Frontend und Backend separat
- **Production**: Docker-Container enthält kompiliertes Frontend und Backend

## Ports

- `3001` - Backend API und Frontend (Production)
- `5173` - Frontend Dev Server (nur Development)

## Troubleshooting

### Container startet nicht
```bash
docker-compose logs
```

### Sonos-Geräte nicht erreichbar
Stelle sicher, dass:
- `network_mode: host` in docker-compose.yml gesetzt ist
- Die Sonos-API URL in `media-data/config.json` korrekt ist
- Die Sonos-Geräte im gleichen Netzwerk sind

### Frontend lädt nicht
```bash
# Rebuild erzwingen
docker-compose build --no-cache
docker-compose up -d
```
