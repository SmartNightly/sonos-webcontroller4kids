"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_PATH = exports.DEFAULT_SONOS_BASE_URL = void 0;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
exports.DEFAULT_SONOS_BASE_URL = 'http://192.168.114.21:5005';
exports.CONFIG_PATH = node_path_1.default.join(__dirname, '..', '..', '..', 'media-data', 'config.json');
function loadConfig() {
    try {
        console.log('Lade config.json von:', exports.CONFIG_PATH);
        console.log('Datei existiert:', node_fs_1.default.existsSync(exports.CONFIG_PATH));
        if (!node_fs_1.default.existsSync(exports.CONFIG_PATH)) {
            console.log('config.json nicht gefunden, verwende Defaults');
            return {
                sonosBaseUrl: exports.DEFAULT_SONOS_BASE_URL,
                rooms: [],
                enabledRooms: [],
                defaultRoom: undefined,
                showShuffleRepeat: true,
                roomIcons: {},
                showTracklistAlbums: true,
                showTracklistAudiobooks: true,
                maxVolume: {},
                activeTemplate: 'default',
            };
        }
        const raw = node_fs_1.default.readFileSync(exports.CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        const rooms = parsed.rooms || [];
        const enabledRooms = parsed.enabledRooms || rooms;
        console.log('config.json geladen:', { rooms: rooms.length, enabledRooms: enabledRooms.length });
        return {
            sonosBaseUrl: parsed.sonosBaseUrl || exports.DEFAULT_SONOS_BASE_URL,
            rooms,
            enabledRooms,
            defaultRoom: parsed.defaultRoom,
            showShuffleRepeat: parsed.showShuffleRepeat !== undefined ? parsed.showShuffleRepeat : true,
            roomIcons: parsed.roomIcons || {},
            showTracklistAlbums: parsed.showTracklistAlbums !== undefined ? parsed.showTracklistAlbums : true,
            showTracklistAudiobooks: parsed.showTracklistAudiobooks !== undefined ? parsed.showTracklistAudiobooks : true,
            maxVolume: parsed.maxVolume || {},
            activeTemplate: parsed.activeTemplate || 'default',
        };
    }
    catch (err) {
        console.error('Fehler beim Laden von config.json:', err);
        return {
            sonosBaseUrl: exports.DEFAULT_SONOS_BASE_URL,
            rooms: [],
            enabledRooms: [],
            defaultRoom: undefined,
            showShuffleRepeat: true,
            roomIcons: {},
            showTracklistAlbums: true,
            showTracklistAudiobooks: true,
            maxVolume: {},
            activeTemplate: 'default',
        };
    }
}
function saveConfig(config) {
    try {
        console.log('Speichere config.json nach:', exports.CONFIG_PATH);
        const dir = node_path_1.default.dirname(exports.CONFIG_PATH);
        if (!node_fs_1.default.existsSync(dir)) {
            console.log('Erstelle Verzeichnis:', dir);
            node_fs_1.default.mkdirSync(dir, { recursive: true });
        }
        node_fs_1.default.writeFileSync(exports.CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        console.log('config.json erfolgreich gespeichert');
    }
    catch (err) {
        console.error('Fehler beim Speichern von config.json:', err);
        throw err;
    }
}
//# sourceMappingURL=config.js.map