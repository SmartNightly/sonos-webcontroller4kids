import type { MediaItem, MediaTrack } from '../types';
export declare function buildSonosUrl(item: MediaItem, room: string, track?: MediaTrack): string;
export type FetchResult = {
    ok: boolean;
    url: string;
    json: unknown;
    text?: never;
    error?: never;
} | {
    ok: boolean;
    url: string;
    text: string;
    json?: never;
    error?: never;
} | {
    ok: false;
    url: string;
    error: string;
    json?: never;
    text?: never;
};
export declare function fetchWithTimeout(url: string, timeoutMs?: number): Promise<FetchResult>;
//# sourceMappingURL=sonos.d.ts.map