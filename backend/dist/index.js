"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const cors_1 = __importDefault(require("cors"));
const health_1 = __importDefault(require("./routes/health"));
const media_1 = __importDefault(require("./routes/media"));
const admin_1 = __importDefault(require("./routes/admin"));
const sonos_1 = __importDefault(require("./routes/sonos"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3344', 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/health', health_1.default);
app.use('/media', media_1.default);
app.use('/admin', admin_1.default);
app.use(sonos_1.default); // handles /sonos/control, /sonos/status, /play, /search/apple
// Serve static frontend files in production (MUSS AM ENDE kommen!)
const frontendPath = node_path_1.default.join(__dirname, '..', '..', 'frontend', 'dist');
console.log('Frontend-Pfad:', frontendPath);
console.log('Frontend existiert:', node_fs_1.default.existsSync(frontendPath));
if (node_fs_1.default.existsSync(frontendPath)) {
    console.log('Frontend-Dateien werden ausgeliefert von:', frontendPath);
    app.use(express_1.default.static(frontendPath));
    // SPA fallback - serve index.html for all non-API routes
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api') &&
            !req.path.startsWith('/media') &&
            !req.path.startsWith('/admin') &&
            !req.path.startsWith('/sonos') &&
            !req.path.startsWith('/search') &&
            !req.path.startsWith('/play')) {
            res.sendFile(node_path_1.default.join(frontendPath, 'index.html'));
        }
        else {
            next();
        }
    });
}
else {
    console.error('WARNUNG: Frontend-Verzeichnis nicht gefunden:', frontendPath);
}
app.listen(PORT, () => {
    console.log(`Backend läuft auf http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map