# GitHub Actions Setup für Docker Hub

## Einmalige Einrichtung

### 1. Docker Hub Account

Falls noch nicht vorhanden:
- Registriere dich auf [hub.docker.com](https://hub.docker.com)
- Username sollte `smartnightly` sein (oder passe in `.github/workflows/docker-publish.yml` an)

### 2. Docker Hub Access Token erstellen

1. Gehe zu [Docker Hub → Account Settings → Security](https://hub.docker.com/settings/security)
2. Klicke auf **New Access Token**
3. Name: `github-actions-sonos-webcontroller`
4. Permissions: **Read & Write**
5. Generiere und **kopiere den Token** (wird nur einmal angezeigt!)

### 3. GitHub Secrets konfigurieren

1. Gehe zu deinem GitHub Repository:
   ```
   https://github.com/SmartNightly/sonos-webcontroller4kids/settings/secrets/actions
   ```

2. Klicke auf **New repository secret**

3. Erstelle folgende Secrets:

   **Secret 1:**
   - Name: `DOCKERHUB_USERNAME`
   - Value: `smartnightly` (dein Docker Hub Username)

   **Secret 2:**
   - Name: `DOCKERHUB_TOKEN`
   - Value: `<dein-access-token>` (aus Schritt 2)

### 4. Repository auf Docker Hub erstellen

1. Gehe zu [hub.docker.com](https://hub.docker.com)
2. Klicke auf **Create Repository**
3. Name: `sonos-webcontroller4kids`
4. Visibility: **Public** (oder Private)
5. Create

Das war's! 🎉

## Nutzung

### Automatisches Build bei Push

Jeder Push auf `main` triggert automatisch:
1. GitHub Actions Workflow startet
2. Docker Image wird gebaut (multi-platform: amd64 + arm64)
3. Image wird auf Docker Hub gepusht als:
   - `smartnightly/sonos-webcontroller4kids:latest`
   - `smartnightly/sonos-webcontroller4kids:main`

### Build-Status prüfen

1. Gehe zu: https://github.com/SmartNightly/sonos-webcontroller4kids/actions
2. Klicke auf den neuesten Workflow
3. Siehe Build-Logs

### Versionen mit Tags

Für spezifische Versionen:
```bash
git tag v1.0.0
git push origin v1.0.0
```

Erstellt zusätzliche Tags:
- `smartnightly/sonos-webcontroller4kids:v1.0.0`
- `smartnightly/sonos-webcontroller4kids:1.0`
- `smartnightly/sonos-webcontroller4kids:1`

## Troubleshooting

### "Error: Cannot connect to the Docker daemon"
→ Normal bei GitHub Actions, wird automatisch gehandhabt

### "Error: denied: requested access to the resource is denied"
→ Prüfe DOCKERHUB_TOKEN und DOCKERHUB_USERNAME Secrets

### "Error: repository does not exist"
→ Erstelle Repository auf Docker Hub (siehe Schritt 4)

### Build dauert lange
→ Normal, Multi-Platform Builds brauchen 5-10 Minuten
→ Caching beschleunigt nachfolgende Builds

## Image verwenden

### Auf Synology/Portainer

```yaml
services:
  sonos-webcontroller:
    image: smartnightly/sonos-webcontroller4kids:latest
    # ... rest der Config
```

### Lokal testen

```bash
docker pull smartnightly/sonos-webcontroller4kids:latest
docker run -p 3001:3001 smartnightly/sonos-webcontroller4kids:latest
```

### Updates holen

```bash
docker pull smartnightly/sonos-webcontroller4kids:latest
docker-compose up -d
```
