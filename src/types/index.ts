export interface Track {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  durationSeconds: number;
  /** Set when this card is a YouTube Music mix/playlist tile, not a single
   * playable song — resolve it via resolveMixQueue() before playing. */
  mixPlaylistId?: string | null;
  canvasYoutubeVideoId?: string | null;
}

export interface Shelf {
  id: string;
  title: string;
  tracks: Track[];
}

export type RepeatMode = 'OFF' | 'ALL' | 'ONE';
