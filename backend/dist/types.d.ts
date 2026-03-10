export type AppConfig = {
    sonosBaseUrl: string;
    rooms: string[];
    enabledRooms: string[];
    defaultRoom?: string | undefined;
    showShuffleRepeat?: boolean;
    roomIcons?: Record<string, string>;
    showTracklistAlbums?: boolean;
    showTracklistAudiobooks?: boolean;
    maxVolume?: Record<string, number>;
    activeTemplate?: string;
};
export type MediaTrack = {
    id: string;
    title: string;
    appleSongId: string;
    trackNumber?: number;
    durationMs?: number;
};
export type MediaItem = {
    id: string;
    title: string;
    kind: 'album' | 'audiobook' | 'playlist' | 'favorite' | 'other';
    service: 'appleMusic' | 'spotify';
    artist?: string;
    album?: string;
    coverUrl: string;
    sonosUri?: string;
    appleId?: string;
    tracks?: MediaTrack[];
};
//# sourceMappingURL=types.d.ts.map