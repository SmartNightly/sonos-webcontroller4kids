"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSonosUrl = buildSonosUrl;
exports.fetchWithTimeout = fetchWithTimeout;
const config_1 = require("./config");
function buildSonosUrl(item, room, track) {
    const config = (0, config_1.loadConfig)();
    const baseUrl = config.sonosBaseUrl || config_1.DEFAULT_SONOS_BASE_URL;
    // 1) Apple Music – einzelner Track
    if (item.service === 'appleMusic' && track && track.appleSongId) {
        const url = `${baseUrl}/${encodeURIComponent(room)}/applemusic/now/song:${track.appleSongId}`;
        console.log('Spiele Track-URL:', url);
        return url;
    }
    // 2) Apple Music – komplettes Album oder Audiobook
    if (item.service === 'appleMusic' && item.appleId) {
        const url = `${baseUrl}/${encodeURIComponent(room)}/applemusic/now/album:${item.appleId}`;
        console.log('Spiele Album/Audiobook-URL:', url);
        return url;
    }
    // 3) Fallback: Sonos-Favoriten oder andere Dienste
    if (item.sonosUri) {
        const url = `${baseUrl}/${encodeURIComponent(room)}/${item.sonosUri}`;
        console.log('Spiele Favoriten-/Fallback-URL:', url);
        return url;
    }
    throw new Error(`Kein Abspielpfad für MediaItem ${item.id} konfiguriert`);
}
async function fetchWithTimeout(url, timeoutMs = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const r = await fetch(url, { signal: controller.signal });
        const text = await r.text().catch(() => '');
        try {
            return { ok: r.ok, url, json: JSON.parse(text) };
        }
        catch {
            return { ok: r.ok, url, text };
        }
    }
    catch (err) {
        if (err && err.name === 'AbortError') {
            return { ok: false, url, error: `timeout after ${timeoutMs}ms` };
        }
        return { ok: false, url, error: String(err) };
    }
    finally {
        clearTimeout(id);
    }
}
//# sourceMappingURL=sonos.js.map