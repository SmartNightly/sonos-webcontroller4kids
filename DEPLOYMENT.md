# Deployment auf Synology / Portainer

## Automatisches Image von Docker Hub (Empfohlen)

Das Image wird automatisch bei jedem Push auf `main` gebaut und auf Docker Hub veröffentlicht:
- **Image:** `smartnightly/sonos-webcontroller4kids:latest`
- **GitHub Actions** baut das Image automatisch
- **Keine manuelle Build-Schritte nötig**

→ Springe direkt zu [Deployment mit Portainer](#deployment-mit-portainer)

---

## Manuelles Deployment (Alternative)

### 1. Image bauen (auf deinem Mac)

```bash
cd "/Users/dominicerni/CloudStation/GitHub Repositories/sonos-webcontroller4kids"

# Image bauen
docker build -t sonos-webcontroller4kids:latest .

# Image als Datei exportieren
docker save sonos-webcontroller4kids:latest -o sonos-webcontroller4kids.tar
```

### 2. Image auf Synology laden

**Option A: Via Portainer Web UI**
1. Portainer → Images → Import
2. Lade `sonos-webcontroller4kids.tar` hoch
3. Tag: `sonos-webcontroller4kids:latest`

**Option B: Via SSH**
```bash
# Auf Synology per SSH
scp sonos-webcontroller4kids.tar admin@deine-synology-ip:/tmp/

# Auf Synology einloggen
ssh admin@deine-synology-ip

# Image laden
docker load -i /tmp/sonos-webcontroller4kids.tar
rm /tmp/sonos-webcontroller4kids.tar
```

### 3. media-data auf Synology kopieren

```bash
# Von deinem Mac
scp -r media-data admin@deine-synology-ip:/volume1/docker/sonos-webcontroller4kids/
```

## Deployment mit Portainer

### Methode 1: Stack aus Repository (Git)

1. In Portainer: **Stacks** → **Add stack**
2. Name: `sonos-webcontroller4kids`
3. Build method: **Repository**
4. Repository URL: `https://github.com/SmartNightly/sonos-webcontroller4kids`
5. Repository reference: `refs/heads/main`
6. Compose path: `docker-compose.yml`
7. **Deploy the stack**

⚠️ **Achtung:** Portainer kann das Image nicht bauen - verwende Methode 2!

### Methode 2: Stack mit Docker Hub Image (Empfohlen ⭐)

**Vorteil:** Keine manuelle Build-Schritte, immer aktuellstes Image

1. **Einmalig:** media-data auf Synology kopieren:
   ```bash
   scp -r media-data admin@synology-ip:/volume1/docker/sonos-webcontroller4kids/
   ```

2. In Portainer: **Stacks** → **Add stack**
3. Name: `sonos-webcontroller4kids`
4. Build method: **Web editor**
5. Kopiere folgenden Inhalt:

```yaml
version: '3.8'

services:
  sonos-webcontroller:
    image: smartnightly/sonos-webcontroller4kids:latest
    container_name: sonos-webcontroller4kids
    
    ports:
      - "3001:3001"
    
    volumes:
      - /volume1/docker/sonos-webcontroller4kids/media-data:/app/media-data
    
    network_mode: host
    
    restart: unless-stopped
    
    environment:
      - NODE_ENV=production
```

6. **Deploy the stack**

**Updates:** Einfach in Portainer auf "Pull and redeploy" klicken!

### Methode 3: Container manuell (ohne Stack)

1. In Portainer: **Containers** → **Add container**
2. Name: `sonos-webcontroller4kids`
3. Image: `sonos-webcontroller4kids:latest`
4. **Network:**
   - Network: `host`
5. **Volumes:**
   - Container: `/app/media-data`
   - Host: `/volume1/docker/sonos-webcontroller4kids/media-data`
6. **Restart policy:** Unless stopped
7. **Deploy the container**

## Updates durchführen

### Mit Docker Hub (Automatisch)

1. **Code pushen:**
   ```bash
   git add .
   git commit -m "Update"
   git push
   ```

2. **GitHub Actions baut automatisch** (dauert ~5-10 Min)

3. **In Portainer:**
   - Stack → "Pull and redeploy"
   - Oder: Container → "Recreate" → "Pull latest image"

### Manuell (nur wenn kein Docker Hub)

```bash
# 1. Auf Mac: Neues Image bauen
docker build -t sonos-webcontroller4kids:latest .
docker save sonos-webcontroller4kids:latest -o sonos-webcontroller4kids.tar

# 2. Auf Synology hochladen und laden
scp sonos-webcontroller4kids.tar admin@synology-ip:/tmp/
ssh admin@synology-ip
docker load -i /tmp/sonos-webcontroller4kids.tar

# 3. In Portainer: Stack → Stop → Start
# Oder: Container → Recreate
```

## Docker Registry (Optional - für automatische Updates)

### Auf Docker Hub pushen

```bash
# 1. Login
docker login

# 2. Tag für Docker Hub
docker tag sonos-webcontroller4kids:latest smartnightly/sonos-webcontroller4kids:latest

# 3. Push
docker push smartnightly/sonos-webcontroller4kids:latest
```

Dann in `docker-compose.portainer.yml`:
```yaml
image: smartnightly/sonos-webcontroller4kids:latest
```

### Private Registry auf Synology

1. In Synology Package Center: **Docker Registry** installieren
2. Registry konfigurieren auf Port 5000
3. Image pushen:

```bash
# Tag für lokale Registry
docker tag sonos-webcontroller4kids:latest synology-ip:5000/sonos-webcontroller4kids:latest

# Push
docker push synology-ip:5000/sonos-webcontroller4kids:latest
```

## Wichtige Pfade

| Zweck | Synology Pfad | Container Pfad |
|-------|---------------|----------------|
| Media Daten | `/volume1/docker/sonos-webcontroller4kids/media-data` | `/app/media-data` |
| Config | `/volume1/docker/sonos-webcontroller4kids/media-data/config.json` | `/app/media-data/config.json` |
| Media Library | `/volume1/docker/sonos-webcontroller4kids/media-data/media.json` | `/app/media-data/media.json` |

## Netzwerk-Konfiguration

Der Container verwendet `network_mode: host` damit er die Sonos-Geräte im lokalen Netzwerk findet.

**Wichtig:** 
- Stelle sicher, dass die Sonos HTTP API (`http://192.168.114.21:5005`) von der Synology erreichbar ist
- Port 3001 muss nicht explizit gemappt werden bei host networking
- Zugriff auf die App: `http://synology-ip:3001`

## Troubleshooting

### Container startet nicht
```bash
ssh admin@synology-ip
docker logs sonos-webcontroller4kids
```

### Sonos nicht erreichbar
```bash
# Teste Verbindung zur Sonos API
curl http://192.168.114.21:5005/zones

# Falls nicht erreichbar, prüfe config.json:
cat /volume1/docker/sonos-webcontroller4kids/media-data/config.json
```

### Portainer zeigt "Image not found"
→ Image auf Synology laden (siehe Schritt 2)

### Updates werden nicht übernommen
```bash
# Image neu laden
docker load -i /tmp/sonos-webcontroller4kids.tar

# In Portainer: Container → Recreate
# Oder: Stack → Stop → Start
```
