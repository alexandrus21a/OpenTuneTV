# OpentuneRN

An Android TV music app that streams real audio from YouTube Music — no API
key, no Google/YouTube account, no login of any kind. A React Native
(`react-native-tvos`) rewrite of an earlier Kotlin/Compose app, keeping the
same core idea: NewPipeExtractor + an unauthenticated YouTube Music Innertube
client as a native bridge, everything else rebuilt in React Native for Android
TV's D-pad-driven UI.

**Android TV only.** No phone/tablet/iOS target.

🇷🇺 Russian version: [README.ru.md](README.ru.md)

## Features

- **Catalog & Home** — real YouTube Music home shelves, no key/login required.
- **Search** — tries YouTube Music's own song search first (clean titles,
  square album art), falls back to a plain video search only if that's empty.
- **Real playback** — audio-only stream resolution (never video) via
  NewPipeExtractor, played with `react-native-video`.
- **Queue** — full editable queue (reorder, remove) in a dedicated modal,
  shuffle, repeat (off/all/one).
- **Personalization without an account** — local-only Like and Follow, used to
  build "Liked Songs" and "Because you follow {artist}" shelves on Home.
- **Canvas backgrounds** — a short, silent, looping video behind Now Playing
  (Spotify-Canvas-style), with a quality setting (Off / Low / High) in
  Settings. Falls back to a blurred artwork background whenever Canvas is off,
  unresolved, or unavailable for a track.
- **Idle screensaver** — after ~18s with no remote input, Now Playing's
  controls fade out, leaving just the Canvas/artwork and a small caption; any
  remote press snaps the UI back instantly.
- **In-app OTA updates** — since this isn't distributed through a store, the
  app can check a small JSON manifest, download a newer APK, and hand it to
  the system installer, all from Settings.
- TV-native interaction design: D-pad focus throughout, real vector icons
  (no emoji), press-down feedback, restrained motion, asymmetric timing
  (fast wake / slow sleep) per Apple's and Emil Kowalski's interaction
  principles.

## Architecture

```
src/
  screens/       Home, NowPlaying, Search, Settings
  components/    GlobalAudioPlayer, TrackCard, MiniTrackCard, Sidebar,
                 CanvasBackground, UpdateSection
  store/         playerStore, settingsStore, followedArtistsStore,
                 likedTracksStore (all useSyncExternalStore-based, in-memory)
  hooks/         useIdle (screensaver)
  native/        JS wrappers around the native bridge modules

android/app/src/main/java/com/opentunern/newpipe/
  OkHttpDownloader, NewPipeBootstrap   NewPipeExtractor plumbing
  Innertube, InnertubeModels,
  InnertubeParser, TitleCleanup        unauthenticated YouTube Music client
  CatalogRepository                    shelves / search / mix-queue resolution
  StreamResolver                       audio-only & video-only stream picking
  NewPipeModule, NewPipePackage        the RN bridge (NativeModule)
  ProxyConfig                          dev-only SOCKS5 proxy, BuildConfig.DEBUG-gated
  OtaModule                            manifest check / download / install
```

The native Kotlin layer does all the YouTube-facing work (no API key, exactly
like the original Compose app); React Native handles every screen, the queue,
settings, and the TV-remote interaction model.

## Requirements

- Bun (package manager; **not** npm/yarn/pnpm)
- JDK 17, Android SDK (`compileSdk`/`targetSdk` per `android/build.gradle`)
- An Android TV device or emulator (API 30+ recommended)

## Getting started

```bash
bun install
bun start                       # Metro dev server
bun run android                 # or: cd android && ./gradlew :app:installDebug
```

Typecheck: `bunx tsc -p tsconfig.json --noEmit`

Native-only changes (anything under `android/app/src/main/java/...` or
`AndroidManifest.xml`) need a rebuild
(`./gradlew :app:assembleDebug --no-daemon`) and reinstall. Pure JS/TSX
changes hot-reload through Metro — no rebuild needed.

## OTA updates

`src/native/OtaModule.ts` exports `OTA_MANIFEST_URL`, currently a placeholder
(`https://REPLACE_ME/...`). To enable updates, host a small JSON file
anywhere static (your own domain, a GitHub raw URL, S3, ...) and point that
constant at it:

```json
{
  "versionCode": 2,
  "versionName": "1.1",
  "apkUrl": "https://example.com/opentune-rn/app-release.apk",
  "notes": "What changed in this release"
}
```

The app compares `versionCode` against the installed build, and only offers a
download when the manifest's is higher.

## Known gaps

- Like/Follow and Canvas-quality settings are in-memory only — they reset on
  app restart (no persistence layer yet).
- `OTA_MANIFEST_URL` needs a real host before updates work outside testing.
- Lyrics (a Musixmatch-style synced view) is a planned feature, not yet built.
- Verified on the Android TV emulator only; no physical-device testing yet.

See `STATUS.md` and `PLAN.md` for the detailed, up-to-date breakdown.
