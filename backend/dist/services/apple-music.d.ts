import type { MediaTrack } from '../types';
export type AppleSearchResult = {
    service: 'appleMusic';
    kind: 'song' | 'album';
    title: string;
    artist: string;
    album: string;
    coverUrl: string;
    appleAlbumId?: string;
    appleSongId?: string;
};
export declare function searchApple(term: string, entity: string, offset: number): Promise<AppleSearchResult[]>;
export declare function fetchAlbumTracks(appleAlbumId: string, mediaItemId: string): Promise<MediaTrack[]>;
//# sourceMappingURL=apple-music.d.ts.map