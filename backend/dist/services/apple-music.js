"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchApple = searchApple;
exports.fetchAlbumTracks = fetchAlbumTracks;
async function searchApple(term, entity, offset) {
    const params = new URLSearchParams({
        term,
        media: 'music',
        entity,
        limit: '100',
        offset: offset.toString(),
        country: 'ch',
    });
    const url = `https://itunes.apple.com/search?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`iTunes API returned ${response.status}`);
    }
    const data = await response.json();
    return (data.results || []).map((item) => {
        var _a;
        const isSong = item.kind === 'song' || item.wrapperType === 'track';
        const result = {
            service: 'appleMusic',
            kind: isSong ? 'song' : 'album',
            title: item.trackName ||
                item.collectionName ||
                item.collectionCensoredName ||
                'Unbekannter Titel',
            artist: item.artistName,
            album: item.collectionName,
            coverUrl: ((_a = item.artworkUrl100) === null || _a === void 0 ? void 0 : _a.replace('100x100bb', '600x600bb')) || '',
        };
        if (item.collectionId)
            result.appleAlbumId = String(item.collectionId);
        if (item.trackId)
            result.appleSongId = String(item.trackId);
        return result;
    });
}
async function fetchAlbumTracks(appleAlbumId, mediaItemId) {
    const params = new URLSearchParams({ id: appleAlbumId, entity: 'song' });
    const url = `https://itunes.apple.com/lookup?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`iTunes lookup returned ${response.status}`);
    }
    const data = await response.json();
    console.log(`iTunes API returned ${data.resultCount} results for album ${appleAlbumId}`);
    const tracks = (data.results || [])
        .filter((r) => r.wrapperType === 'track' || r.kind === 'song')
        .map((r) => ({
        id: `${mediaItemId}_track_${r.trackId}`,
        title: r.trackName,
        appleSongId: String(r.trackId),
        trackNumber: r.trackNumber,
        durationMs: r.trackTimeMillis,
    }));
    return tracks;
}
//# sourceMappingURL=apple-music.js.map