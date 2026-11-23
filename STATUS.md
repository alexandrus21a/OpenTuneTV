# OpentuneRN — Status

Android TV music app, React Native (react-native-tvos) rewrite of the original
Kotlin/Compose "opentune" app (`~/projects/opentune`, left untouched as reference).
Android TV only — no mobile/iOS target.

## Stack
- React Native 0.83 via `react-native-tvos` (package.json aliases `react-native` →
  `npm:react-native-tvos`). `newArchEnabled=false` (TV recommendation; plain
  `NativeModule`s, not TurboModules/Codegen).
- Bun for JS tooling. TypeScript, no build step beyond Metro.
- Kotlin native layer ported from the Compose app: NewPipeExtractor (audio/video
  stream resolving) + an unauthenticated YouTube Music Innertube (WEB_REMIX)
  client for catalog/search — no API key, no login, same approach as the
  original app.

## What works (verified on the `opentune_tv11` emulator)
- **Home**: real YouTube Music shelves (`NewPipeModule.loadShelves`) + two
  personalized shelves built client-side ("Liked Songs", "Because you follow
  {artist}") from the local like/follow stores.
- **Playback**: real audio via `react-native-video`, resolved through
  `StreamResolver.resolveAudio` (audio-only streams, never video). Queue with
  shuffle/repeat, skip, seek. Verified real-time progress against a 24-track
  queue.
- **Queue editing**: modal (`QueueModal`, opened via the list icon in Now
  Playing — explicitly NOT inline) with reorder (▲▼) and remove.
- **Search**: `CatalogRepository.searchTracks` tries YouTube Music's own
  Innertube `search` endpoint first (recursive walk for
  `musicResponsiveListItemRenderer`, not a fixed path — the signed-out search
  response's envelope shape isn't stable enough to hard-code), filtered to
  square-thumbnail results (real songs, not video uploads); falls back to
  NewPipeExtractor's plain video search only if that's empty. Verified: "$uicideboy$"
  search returns 8 clean song results with real square album art.
- **Personalization, no account**: local-only `followedArtistsStore` /
  `likedTracksStore` (in-memory `useSyncExternalStore`-backed, not persisted to
  disk yet — see Plan). Like/Follow pills on Now Playing.
- **Canvas backgrounds**: looping silent video behind Now Playing
  (`StreamResolver.resolveCanvas`, video-only streams, AV1 skipped — most
  Android TV boxes decode AV1 in software). Quality setting in Settings
  (Off / Low / High — `settingsStore.canvasQuality`), falls back to a blurred
  artwork background when off, not yet resolved, or resolution fails — never a
  black screen.
- **Idle screensaver**: `useIdle(18000)` hook (`src/hooks/useIdle.ts`) via RN-TV's
  `useTVEventHandler` (fires on every remote event app-wide, not just local
  focus). After 18s with no remote input, Now Playing's controls fade out
  (500ms) leaving just the Canvas/artwork fullscreen + a small corner caption;
  any new remote event snaps controls back in fast (180ms). Disabled while the
  queue modal is open. Verified both directions on-device.
- **In-app OTA updates**: native `OtaModule.kt` — fetch a small JSON manifest
  (`{versionCode, versionName, apkUrl, notes}`), compare to the installed
  `versionCode`, download the APK (progress events to JS), then hand it to the
  system installer via `FileProvider` (`ACTION_VIEW` +
  `application/vnd.android.package-archive`). Settings → UPDATES has the
  manual "Check for updates" flow (no silent background install — TV install
  flows need the system installer screen's explicit confirmation anyway).
  Verified full pipeline end-to-end against a local test server: manifest
  fetch → version compare → download with live progress → permission gate
  (`REQUEST_INSTALL_PACKAGES`, Android 8+) → real system installer dialog
  reached ("Do you want to install an update... INSTALL/CANCEL").
  **`OTA_MANIFEST_URL` in `src/native/OtaModule.ts` is still a placeholder**
  (`https://REPLACE_ME/...`) — needs a real static host for the manifest + APK
  before this is usable in the wild.
- **UI redesign**: Now Playing rebuilt around Emil Kowalski's and Apple's
  interaction-design principles — press-down (not release) feedback, fast
  asymmetric wake vs. slow sleep timing, restrained motion. Waveform-style
  progress bar (56 bars, deterministic per-track amplitudes). All transport
  buttons, Like/Follow, queue edit buttons, and the queue-close button use
  `react-native-vector-icons` (Ionicons) — no emoji or Unicode glyphs
  anywhere in the player.

## Known limitations / not yet done
- Lyrics (Musixmatch-style synced view) — explicitly deferred, see PLAN.md.
- Like/Follow stores are in-memory only; cleared on app restart (no
  AsyncStorage/SQLite persistence yet).
- `settingsStore` (Canvas quality) is also in-memory only, same gap.
- OTA manifest/APK hosting is not set up — `OTA_MANIFEST_URL` is a placeholder.
- No real-device (physical Android TV) testing yet — everything verified on
  the `opentune_tv11` emulator only.
- Dev-only SOCKS5 proxy (`ProxyConfig.kt`, gated `BuildConfig.DEBUG`) is
  required in *this* cloud dev environment because YouTube blocks the host's
  IP ("Sign in to confirm you're not a bot"); it must never ship in release
  and is not needed for real end users on their own (normally unblocked) IPs.
- iOS was explicitly ruled out — Android TV only, by user decision.

## Key files
- `android/app/src/main/java/com/opentunern/newpipe/` — all native Kotlin:
  `OkHttpDownloader`, `NewPipeBootstrap`, `Innertube`, `InnertubeModels`,
  `InnertubeParser`, `TitleCleanup`, `CatalogRepository`, `StreamResolver`,
  `NewPipeModule`, `NewPipePackage`, `ProxyConfig`, `OtaModule`.
- `src/screens/` — `HomeScreen`, `NowPlayingScreen`, `SettingsScreen`,
  `SearchScreen`.
- `src/components/` — `GlobalAudioPlayer`, `TrackCard`, `MiniTrackCard`,
  `Sidebar`, `CanvasBackground`, `UpdateSection`.
- `src/store/` — `playerStore`/`usePlayerState`, `settingsStore`/
  `useSettingsState`, `followedArtistsStore`, `likedTracksStore`.
- `src/hooks/useIdle.ts` — screensaver idle-detection hook.
- `src/native/` — JS wrappers for native bridges: `NewPipeModule.ts`,
  `OtaModule.ts`.
- `tv_test_screens/` — current screenshot set from the emulator (refreshed
  each time screens change materially; old sets get deleted, not
  accumulated).
