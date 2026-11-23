import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Shelf, Track } from '../types';
import { loadShelves, resolveMixQueue, searchTracks } from '../native/NewPipeModule';
import { TrackCard } from '../components/TrackCard';
import { Sidebar, type SidebarDestination } from '../components/Sidebar';
import { useSyncExternalStore } from 'react';
import { likedTracksStore } from '../store/likedTracksStore';
import { followedArtistsStore } from '../store/followedArtistsStore';

type LoadState = 'loading' | 'loaded' | 'error';

/**
 * Home: a hero banner that reacts to whichever card currently has D-pad
 * focus, with shelves scrolling below it — same layout idea as the
 * Compose app's HomeScreen. Shelves/tracks come from NewPipeModule
 * (real YouTube Music Home browse, falling back to search), not mock
 * data. Mix/playlist tiles (`track.mixPlaylistId`) are resolved into
 * their real songs only once selected, same "play this mix" flow as the
 * Compose app.
 */
export function HomeScreen({
  onPlayTrack,
  onOpenSettings,
  onOpenSearch,
  sidebarDestination,
  onSelectSidebar,
}: {
  onPlayTrack: (queue: Track[], track: Track) => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  sidebarDestination: SidebarDestination;
  onSelectSidebar: (destination: SidebarDestination) => void;
}): React.JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [personalizedShelves, setPersonalizedShelves] = useState<Shelf[]>([]);
  const [focusedTrack, setFocusedTrack] = useState<Track | null>(null);
  const firstTrackId = useRef<string | null>(null);
  const likedTracks = useSyncExternalStore(likedTracksStore.subscribe, likedTracksStore.getTracks);
  const followedArtists = useSyncExternalStore(followedArtistsStore.subscribe, followedArtistsStore.getArtists);

  useEffect(() => {
    let cancelled = false;
    loadShelves()
      .then(loaded => {
        if (cancelled) return;
        if (!loaded || loaded.length === 0) {
          setLoadState('error');
          return;
        }
        setShelves(loaded);
        const first = loaded[0]?.tracks[0] ?? null;
        setFocusedTrack(first);
        firstTrackId.current = first?.id ?? null;
        setLoadState('loaded');
      })
      .catch(() => !cancelled && setLoadState('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  // Local-only "recommendations": no account/login, so personalization
  // comes entirely from on-device likes/follows — a shelf of liked
  // songs, plus a search-backed shelf per followed artist (capped to 3
  // so Home doesn't fire a burst of searches).
  useEffect(() => {
    let cancelled = false;
    async function build() {
      const extra: Shelf[] = [];
      if (likedTracks.length > 0) {
        extra.push({ id: 'liked', title: 'Liked Songs', tracks: [...likedTracks].reverse() });
      }
      for (const artist of followedArtists.slice(0, 3)) {
        const tracks = await searchTracks(`${artist} songs`).catch(() => []);
        if (tracks.length > 0) {
          extra.push({ id: `follow_${artist}`, title: `Because you follow ${artist}`, tracks });
        }
      }
      if (!cancelled) setPersonalizedShelves(extra);
    }
    build();
    return () => {
      cancelled = true;
    };
  }, [likedTracks, followedArtists]);

  function handleSelectTrack(shelf: Shelf, track: Track) {
    if (track.mixPlaylistId) {
      resolveMixQueue(track.mixPlaylistId).then(queue => {
        const first = queue[0];
        if (first) onPlayTrack(queue, first);
      });
    } else {
      const queue = shelf.tracks.filter(t => !t.mixPlaylistId);
      onPlayTrack(queue, track);
    }
  }

  return (
    <View style={styles.root}>
      {loadState === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color="#FF5500" size="large" />
          <Text style={styles.centerText}>Loading music from YouTube…</Text>
        </View>
      )}

      {loadState === 'error' && (
        <View style={styles.center}>
          <Text style={styles.centerText}>Couldn't load music from YouTube. Check the connection.</Text>
        </View>
      )}

      {loadState === 'loaded' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {focusedTrack && <HeroSection track={focusedTrack} />}
          {personalizedShelves.map(shelf => (
            <ShelfRow
              key={shelf.id}
              shelf={shelf}
              onFocusTrack={setFocusedTrack}
              onSelectTrack={track => handleSelectTrack(shelf, track)}
              hasTVPreferredFocusTrackId={null}
            />
          ))}
          {shelves.map(shelf => (
            <ShelfRow
              key={shelf.id}
              shelf={shelf}
              onFocusTrack={setFocusedTrack}
              onSelectTrack={track => handleSelectTrack(shelf, track)}
              hasTVPreferredFocusTrackId={shelf === shelves[0] ? firstTrackId.current : null}
            />
          ))}
        </ScrollView>
      )}

      <Sidebar
        selected={sidebarDestination}
        onSelect={destination => {
          onSelectSidebar(destination);
          if (destination === 'Settings') onOpenSettings();
          if (destination === 'Search') onOpenSearch();
        }}
      />
    </View>
  );
}

function HeroSection({ track }: { track: Track }) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroTextBlock}>
        <Text style={styles.heroLabel}>MADE FOR YOU</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {track.title}
        </Text>
        <Text style={styles.heroArtist}>{track.artist}</Text>
      </View>
      <Image source={{ uri: track.artworkUrl }} style={styles.heroArtwork} resizeMode="cover" />
    </View>
  );
}

function ShelfRow({
  shelf,
  onFocusTrack,
  onSelectTrack,
  hasTVPreferredFocusTrackId,
}: {
  shelf: Shelf;
  onFocusTrack: (track: Track) => void;
  onSelectTrack: (track: Track) => void;
  hasTVPreferredFocusTrackId: string | null;
}) {
  return (
    <View style={styles.shelf}>
      <Text style={styles.shelfTitle}>{shelf.title}</Text>
      <FlatList
        horizontal
        data={shelf.tracks}
        keyExtractor={t => t.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shelfList}
        renderItem={({ item }) => (
          <TrackCard
            track={item}
            onFocus={onFocusTrack}
            onPress={onSelectTrack}
            hasTVPreferredFocus={item.id === hasTVPreferredFocusTrackId}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, textAlign: 'center', paddingHorizontal: 48 },
  scrollContent: { paddingLeft: 112, paddingBottom: 48 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
    paddingRight: 48,
    gap: 24,
  },
  heroTextBlock: { flex: 1 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  heroArtist: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  heroArtwork: { width: 200, height: 200, borderRadius: 12, backgroundColor: '#222' },
  shelf: { marginTop: 24 },
  shelfTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  shelfList: { gap: 16, paddingRight: 48 },
});
