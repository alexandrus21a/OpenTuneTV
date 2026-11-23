import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type SidebarDestination = 'Home' | 'Search' | 'Library' | 'Settings';

const ITEMS: Array<{ id: SidebarDestination; icon: string; label: string }> = [
  { id: 'Home', icon: '⌂', label: 'Home' },
  { id: 'Search', icon: '⌕', label: 'Search' },
  { id: 'Library', icon: '♫', label: 'Library' },
  { id: 'Settings', icon: '⚙', label: 'Settings' },
];

const ACCENT = '#FF5500';

/**
 * Icon-only rail that expands into a labeled drawer while any item in it
 * has D-pad focus — mirrors the Compose app's Sidebar (overlay that
 * never pushes content to the side).
 */
export function Sidebar({
  selected,
  onSelect,
}: {
  selected: SidebarDestination;
  onSelect: (destination: SidebarDestination) => void;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      style={[styles.rail, { width: expanded ? 220 : 88 }]}
      onStartShouldSetResponder={() => false}>
      {ITEMS.map(item => (
        <SidebarItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          showLabel={expanded}
          isSelected={item.id === selected}
          onFocus={() => setExpanded(true)}
          onBlur={() => setExpanded(false)}
          onPress={() => onSelect(item.id)}
        />
      ))}
    </View>
  );
}

function SidebarItem({
  icon,
  label,
  showLabel,
  isSelected,
  onFocus,
  onBlur,
  onPress,
}: {
  icon: string;
  label: string;
  showLabel: boolean;
  isSelected: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const active = isSelected || focused;

  return (
    <Pressable
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur();
      }}
      onPress={onPress}
      style={styles.item}>
      <Text style={[styles.icon, active && styles.iconActive]}>{icon}</Text>
      {showLabel && <Text style={[styles.label, active && styles.iconActive]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    height: '100%',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 28,
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  icon: { fontSize: 22, color: 'rgba(255,255,255,0.75)', width: 28, textAlign: 'center' },
  iconActive: { color: ACCENT },
  label: { fontSize: 15, color: 'rgba(255,255,255,0.75)' },
});
