import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Track } from '../types';

const ACCENT = '#FF5500';

/**
 * Spotify-style square shelf card — artwork fills the card, title/artist
 * sit over a bottom scrim. Border lights up accent-colored on D-pad
 * focus. A mix/playlist tile (track.mixPlaylistId set) gets a small
 * "mix" badge so a curated cover reads as playable-and-different from a
 * plain track thumbnail, same as the Compose app's TrackCard.
 */
export function TrackCard({
  track,
  onFocus,
  onPress,
  hasTVPreferredFocus,
  size = 160,
}: {
  track: Track;
  onFocus?: (track: Track) => void;
  onPress: (track: Track) => void;
  hasTVPreferredFocus?: boolean;
  size?: number;
}): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const isMix = !!track.mixPlaylistId;

  return (
    <Pressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => {
        setFocused(true);
        onFocus?.(track);
      }}
      onBlur={() => setFocused(false)}
      onPress={() => onPress(track)}
      style={[
        styles.card,
        { width: size, height: size, transform: [{ scale: focused ? 1.08 : 1 }] },
        focused && styles.cardFocused,
      ]}>
      <Image source={{ uri: track.artworkUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {isMix && (
        <View style={styles.mixBadge}>
          <Text style={styles.mixBadgeText}>▶</Text>
        </View>
      )}
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={isMix ? 1 : 2}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1c1c1c',
    borderWidth: 0,
  },
  cardFocused: {
    borderWidth: 3,
    borderColor: ACCENT,
  },
  mixBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixBadgeText: { color: '#fff', fontSize: 11 },
  textBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  title: { color: '#fff', fontSize: 14, fontWeight: '600' },
  artist: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
});
