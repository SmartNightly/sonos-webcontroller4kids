"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const config_1 = require("../services/config");
const router = (0, express_1.Router)();
// GET /admin/sonos
router.get('/sonos', (req, res) => {
    try {
        const config = (0, config_1.loadConfig)();
        res.json(config);
    }
    catch (err) {
        console.error('Fehler beim Laden der Sonos-Konfiguration:', err);
        res.status(500).json({ error: 'Sonos-Konfiguration konnte nicht geladen werden' });
    }
});
// GET /admin/sonos/test
router.get('/sonos/test', async (req, res) => {
    try {
        const config = (0, config_1.loadConfig)();
        const baseUrl = config.sonosBaseUrl || config_1.DEFAULT_SONOS_BASE_URL;
        const testUrl = `${baseUrl}/zones`;
        console.log('Teste Sonos API Verbindung:', testUrl);
        const response = await fetch(testUrl);
        const data = await response.json();
        res.json({
            status: 'ok',
            sonosBaseUrl: baseUrl,
            reachable: true,
            zones: data.length || 0,
            message: `Sonos API erreichbar, ${data.length || 0} Zonen gefunden`,
        });
    }
    catch (err) {
        console.error('Sonos API Test fehlgeschlagen:', err);
        const config = (0, config_1.loadConfig)();
        res.status(502).json({
            status: 'error',
            sonosBaseUrl: config.sonosBaseUrl || config_1.DEFAULT_SONOS_BASE_URL,
            reachable: false,
            error: err.message || 'Unbekannter Fehler',
            message: 'Sonos API nicht erreichbar',
        });
    }
});
// POST /admin/sonos/discover
router.post('/sonos/discover', async (req, res) => {
    var _a;
    const { sonosBaseUrl } = req.body;
    const current = (0, config_1.loadConfig)();
    const baseUrl = (sonosBaseUrl && sonosBaseUrl.trim().replace(/\/+$/, '')) ||
        current.sonosBaseUrl ||
        config_1.DEFAULT_SONOS_BASE_URL;
    async function tryFetchRoomsEndpoint() {
        const url = `${baseUrl}/rooms`;
        console.log('Versuche Sonos /rooms:', url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Sonos /rooms returned ${response.status}`);
        }
        const data = (await response.json());
        return (data || [])
            .map((r) => r.roomName || r.name)
            .filter((name) => typeof name === 'string')
            .filter((name, idx, arr) => arr.indexOf(name) === idx);
    }
    async function tryFetchZonesEndpoint() {
        const url = `${baseUrl}/zones`;
        console.log('Versuche Sonos /zones:', url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Sonos /zones returned ${response.status}`);
        }
        const data = (await response.json());
        return (data || [])
            .flatMap((zone) => zone.members || [])
            .map((m) => m.roomName || m.name)
            .filter((name) => typeof name === 'string')
            .filter((name, idx, arr) => arr.indexOf(name) === idx);
    }
    try {
        let rooms = [];
        try {
            rooms = await tryFetchRoomsEndpoint();
            console.log('Sonos-Räume aus /rooms:', rooms);
        }
        catch (err) {
            console.warn('Konnte /rooms nicht verwenden, versuche /zones:', err);
            rooms = await tryFetchZonesEndpoint();
            console.log('Sonos-Räume aus /zones:', rooms);
        }
        if (!rooms || rooms.length === 0) {
            throw new Error('Keine Sonos-Räume gefunden');
        }
        const oldConfig = (0, config_1.loadConfig)();
        const enabledRoomsIntersection = ((_a = oldConfig.enabledRooms) === null || _a === void 0 ? void 0 : _a.filter(r => rooms.includes(r))) || [];
        const enabledRooms = enabledRoomsIntersection.length > 0 ? enabledRoomsIntersection : rooms;
        const defaultRoom = oldConfig.defaultRoom && enabledRooms.includes(oldConfig.defaultRoom)
            ? oldConfig.defaultRoom
            : undefined;
        const newConfig = {
            sonosBaseUrl: baseUrl,
            rooms,
            enabledRooms,
            defaultRoom,
        };
        (0, config_1.saveConfig)(newConfig);
        res.json(newConfig);
    }
    catch (err) {
        console.error('Fehler beim Holen der Sonos-Räume:', err);
        res.status(502).json({
            error: 'Sonos-Räume konnten nicht geladen werden. Details siehe Backend-Log.',
        });
    }
});
// POST /admin/sonos/rooms
router.post('/sonos/rooms', (req, res) => {
    const { enabledRooms } = req.body;
    if (!Array.isArray(enabledRooms)) {
        return res.status(400).json({ error: 'enabledRooms muss ein Array sein' });
    }
    const config = (0, config_1.loadConfig)();
    const cleaned = enabledRooms.filter(r => config.rooms.includes(r));
    const newConfig = { ...config, enabledRooms: cleaned };
    (0, config_1.saveConfig)(newConfig);
    res.json(newConfig);
});
// POST /admin/sonos/default-room
router.post('/sonos/default-room', (req, res) => {
    const { defaultRoom } = req.body;
    const config = (0, config_1.loadConfig)();
    if (defaultRoom && !config.enabledRooms.includes(defaultRoom)) {
        return res.status(400).json({
            error: 'defaultRoom muss einer der aktivierten Räume sein',
        });
    }
    const newConfig = { ...config, defaultRoom: defaultRoom || undefined };
    (0, config_1.saveConfig)(newConfig);
    res.json(newConfig);
});
// POST /admin/sonos/settings
router.post('/sonos/settings', (req, res) => {
    var _a;
    const { showShuffleRepeat, maxVolume } = req.body;
    const config = (0, config_1.loadConfig)();
    const newConfig = {
        ...config,
        showShuffleRepeat: showShuffleRepeat !== undefined ? showShuffleRepeat : ((_a = config.showShuffleRepeat) !== null && _a !== void 0 ? _a : true),
        maxVolume: maxVolume !== undefined ? maxVolume : (config.maxVolume || {}),
    };
    (0, config_1.saveConfig)(newConfig);
    res.json(newConfig);
});
// POST /admin/sonos/room-icons
router.post('/sonos/room-icons', (req, res) => {
    const { roomIcons } = req.body;
    const config = (0, config_1.loadConfig)();
    const newConfig = {
        ...config,
        roomIcons: roomIcons || config.roomIcons || {},
    };
    (0, config_1.saveConfig)(newConfig);
    res.json(newConfig);
});
// POST /admin/sonos/tracklist-settings
router.post('/sonos/tracklist-settings', (req, res) => {
    const { showTracklistAlbums, showTracklistAudiobooks } = req.body;
    const config = (0, config_1.loadConfig)();
    if (showTracklistAlbums !== undefined)
        config.showTracklistAlbums = showTracklistAlbums;
    if (showTracklistAudiobooks !== undefined)
        config.showTracklistAudiobooks = showTracklistAudiobooks;
    (0, config_1.saveConfig)(config);
    res.json(config);
});
// GET /admin/templates
router.get('/templates', (req, res) => {
    const templatesPath = node_path_1.default.join(__dirname, '..', '..', '..', 'frontend', 'src', 'templates');
    try {
        if (!node_fs_1.default.existsSync(templatesPath)) {
            return res.json({ templates: ['default'], active: 'default' });
        }
        const templates = node_fs_1.default.readdirSync(templatesPath).filter(name => {
            const templatePath = node_path_1.default.join(templatesPath, name);
            return node_fs_1.default.statSync(templatePath).isDirectory();
        });
        const config = (0, config_1.loadConfig)();
        res.json({ templates, active: config.activeTemplate || 'default' });
    }
    catch (err) {
        console.error('Fehler beim Laden der Templates:', err);
        res.status(500).json({ error: 'Templates konnten nicht geladen werden' });
    }
});
// POST /admin/templates/active
router.post('/templates/active', (req, res) => {
    const { template } = req.body;
    if (!template) {
        return res.status(400).json({ error: 'template ist erforderlich' });
    }
    const templatesPath = node_path_1.default.join(__dirname, '..', '..', '..', 'frontend', 'src', 'templates', template);
    if (!node_fs_1.default.existsSync(templatesPath)) {
        return res.status(404).json({ error: `Template '${template}' nicht gefunden` });
    }
    const config = (0, config_1.loadConfig)();
    config.activeTemplate = template;
    (0, config_1.saveConfig)(config);
    res.json({ success: true, activeTemplate: template });
});
exports.default = router;
//# sourceMappingURL=admin.js.map