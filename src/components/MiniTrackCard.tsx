import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Track } from '../types';

const ACCENT = '#FF5500';

/**
 * Compact horizontal row for the Now Playing queue: small square
 * artwork + title/artist, highlighted when it's the currently-playing
 * track. Editable with D-pad-friendly buttons instead of drag — move up
 * ("▲"), move down ("▼") and remove ("✕") are their own focusable
 * targets, no gesture needed.
 */
export function MiniTrackCard({
  track,
  isCurrent,
  onPress,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  track: Track;
  isCurrent: boolean;
  onPress: (track: Track) => void;
  onRemove: (track: Track) => void;
  onMoveUp: (track: Track) => void;
  onMoveDown: (track: Track) => void;
}): React.JSX.Element {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.row, focused && styles.rowFocused, isCurrent && styles.rowCurrent]}>
      <Pressable
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPress={() => onPress(track)}
        style={styles.main}>
        <Image source={{ uri: track.artworkUrl }} style={styles.artwork} resizeMode="cover" />
        <View style={styles.meta}>
          <Text style={[styles.title, isCurrent && styles.titleCurrent]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist}
          </Text>
        </View>
        {isCurrent && <View style={styles.playingDot} />}
      </Pressable>

      <View style={styles.actions}>
        <QueueActionButton icon="chevron-up" onPress={() => onMoveUp(track)} />
        <QueueActionButton icon="chevron-down" onPress={() => onMoveDown(track)} />
        <QueueActionButton icon="close" onPress={() => onRemove(track)} />
      </View>
    </View>
  );
}

function QueueActionButton({ icon, onPress }: { icon: string; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.actionButton, focused && styles.actionButtonFocused]}>
      <Icon name={icon} size={14} color={focused ? '#000' : 'rgba(255,255,255,0.75)'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  rowFocused: { backgroundColor: 'rgba(255,255,255,0.08)' },
  rowCurrent: { backgroundColor: 'rgba(255,85,0,0.12)' },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  artwork: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#222' },
  meta: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600' },
  titleCurrent: { color: ACCENT },
  artist: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  playingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  actions: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionButtonFocused: { backgroundColor: ACCENT },
  actionLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  actionLabelFocused: { color: '#000' },
});
