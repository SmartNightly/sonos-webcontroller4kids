"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEDIA_PATH = void 0;
exports.loadMedia = loadMedia;
exports.saveMedia = saveMedia;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
exports.MEDIA_PATH = node_path_1.default.join(__dirname, '..', '..', '..', 'media-data', 'media.json');
function loadMedia() {
    try {
        console.log('Lade media.json von:', exports.MEDIA_PATH);
        console.log('Datei existiert:', node_fs_1.default.existsSync(exports.MEDIA_PATH));
        if (!node_fs_1.default.existsSync(exports.MEDIA_PATH)) {
            console.log('media.json nicht gefunden, erstelle leeres Array');
            return [];
        }
        const fileContent = node_fs_1.default.readFileSync(exports.MEDIA_PATH, 'utf-8');
        const parsed = JSON.parse(fileContent);
        console.log(`media.json geladen: ${parsed.length} Einträge`);
        return parsed;
    }
    catch (err) {
        console.error('Fehler beim Laden von media.json:', err);
        return [];
    }
}
function saveMedia(items) {
    try {
        console.log('Speichere media.json nach:', exports.MEDIA_PATH);
        console.log('Anzahl Einträge:', items.length);
        const dir = node_path_1.default.dirname(exports.MEDIA_PATH);
        if (!node_fs_1.default.existsSync(dir)) {
            console.log('Erstelle Verzeichnis:', dir);
            node_fs_1.default.mkdirSync(dir, { recursive: true });
        }
        node_fs_1.default.writeFileSync(exports.MEDIA_PATH, JSON.stringify(items, null, 2), 'utf-8');
        console.log('media.json erfolgreich gespeichert');
    }
    catch (err) {
        console.error('Fehler beim Speichern von media.json:', err);
        throw err;
    }
}
//# sourceMappingURL=media.js.map