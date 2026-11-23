import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Track } from '../types';
import { searchTracks } from '../native/NewPipeModule';
import { TrackCard } from '../components/TrackCard';

type SearchState = 'idle' | 'loading' | 'done' | 'error';

/**
 * Free-text search — no account needed (same anonymous YouTube search
 * NewPipeExtractor already uses for Home's fallback shelves). Submitting
 * the on-screen keyboard runs the query; results reuse TrackCard in a
 * simple wrapping grid via FlatList's numColumns.
 */
export function SearchScreen({
  onPlayTrack,
}: {
  onPlayTrack: (queue: Track[], track: Track) => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [results, setResults] = useState<Track[]>([]);

  function runSearch(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState('loading');
    searchTracks(trimmed)
      .then(tracks => {
        setResults(tracks);
        setState(tracks.length > 0 ? 'done' : 'error');
      })
      .catch(() => setState('error'));
  }

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Search</Text>
      <TextInput
        autoFocus
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => runSearch(query)}
        placeholder="Search for a song or artist…"
        placeholderTextColor="rgba(255,255,255,0.4)"
        style={styles.input}
        returnKeyType="search"
      />

      {state === 'loading' && <ActivityIndicator color="#FF5500" style={styles.spinner} />}
      {state === 'error' && <Text style={styles.message}>No results. Try a different search.</Text>}

      {state === 'done' && (
        <FlatList
          data={results}
          numColumns={5}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <TrackCard track={item} onPress={track => onPlayTrack(results, track)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: 112, paddingTop: 48 },
  heading: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 24 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 18,
    maxWidth: 560,
  },
  spinner: { marginTop: 40 },
  message: { color: 'rgba(255,255,255,0.6)', marginTop: 40, fontSize: 15 },
  grid: { marginTop: 32, paddingBottom: 48 },
  row: { gap: 16, marginBottom: 16 },
});
