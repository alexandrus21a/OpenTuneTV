/**
 * @format
 */
import React, { useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { NowPlayingScreen } from './src/screens/NowPlayingScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { GlobalAudioPlayer } from './src/components/GlobalAudioPlayer';
import { playerStore } from './src/store/playerStore';
import type { SidebarDestination } from './src/components/Sidebar';
import type { Track } from './src/types';

type Overlay = 'none' | 'nowPlaying' | 'settings' | 'search';

/**
 * Home stays mounted permanently; Now Playing / Settings / Search are
 * overlays drawn on top (same reasoning as the Compose app's
 * MainActivity: Home shouldn't be torn down and rebuilt on every trip
 * away and back). GlobalAudioPlayer is mounted once here regardless of
 * overlay — audio keeps playing while browsing Home/Search.
 */
function App(): React.JSX.Element {
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [sidebarDestination, setSidebarDestination] = useState<SidebarDestination>('Home');

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (overlay !== 'none') {
        setOverlay('none');
        setSidebarDestination('Home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [overlay]);

  function handlePlayTrack(queue: Track[], track: Track) {
    playerStore.play(track, queue);
    setOverlay('nowPlaying');
  }

  return (
    <View style={styles.root}>
      <HomeScreen
        onPlayTrack={handlePlayTrack}
        onOpenSettings={() => setOverlay('settings')}
        onOpenSearch={() => setOverlay('search')}
        sidebarDestination={sidebarDestination}
        onSelectSidebar={setSidebarDestination}
      />

      {overlay === 'nowPlaying' && (
        <View style={StyleSheet.absoluteFill}>
          <NowPlayingScreen />
        </View>
      )}

      {overlay === 'settings' && (
        <View style={StyleSheet.absoluteFill}>
          <SettingsScreen />
        </View>
      )}

      {overlay === 'search' && (
        <View style={StyleSheet.absoluteFill}>
          <SearchScreen onPlayTrack={handlePlayTrack} />
        </View>
      )}

      <GlobalAudioPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});

export default App;
