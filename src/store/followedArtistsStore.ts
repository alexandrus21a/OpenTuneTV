type Listener = () => void;

/**
 * "Subscribe" without an account: a purely local, on-device list of
 * followed artist names — no YouTube login, no server. Followed artists
 * just get a bookmark the UI can show/filter by; there is nothing to
 * sync anywhere.
 *
 * Caches the array snapshot and only rebuilds it on an actual change —
 * useSyncExternalStore requires getSnapshot to return a stable
 * reference when nothing changed, or React re-renders forever.
 */
class FollowedArtistsStore {
  private artists = new Set<string>();
  private snapshot: string[] = [];
  private listeners = new Set<Listener>();

  getArtists = (): string[] => this.snapshot;

  isFollowed = (artist: string): boolean => this.artists.has(artist);

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  toggle(artist: string) {
    if (this.artists.has(artist)) this.artists.delete(artist);
    else this.artists.add(artist);
    this.snapshot = Array.from(this.artists);
    this.listeners.forEach(l => l());
  }
}

export const followedArtistsStore = new FollowedArtistsStore();
