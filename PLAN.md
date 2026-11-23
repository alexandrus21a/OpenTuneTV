# OpentuneRN — Plan / Backlog

See `STATUS.md` for what's already working and verified.

## Next up

- **Lyrics (Musixmatch-style)** — deferred mid-design, not started.
  Design sketch (not yet implemented):
  - Source: [LRCLIB](https://lrclib.net/api) — free, no API key, matches by
    track/artist/(album)/duration, returns `syncedLyrics` (LRC format,
    line-timestamped) and `plainLyrics`. Plain `fetch()` from JS is enough,
    no native module needed (LRCLIB isn't YouTube, not subject to the same
    anti-bot blocking the dev-proxy works around).
  - `src/native/lyricsApi.ts`: `parseLrc(lrc: string)` → `{timeSeconds, text}[]`,
    `fetchLyrics(trackName, artistName, durationSeconds)` → try `/api/get`
    (exact match), fall back to `/api/search` (fuzzy) if 404/empty.
  - `src/hooks/useLyrics(track)`: fetch + simple in-memory `Map<trackId, result>`
    cache, so reopening the lyrics view for the same track doesn't refetch.
  - UI: a `LyricsModal`, full-screen (not a side panel like the queue) —
    current line large/centered, auto-scrolling `FlatList` keyed by
    `positionSeconds` from the existing player store, dimmed context lines
    above/below. Plain-text fallback when only unsynced lyrics exist;
    "Instrumental" state; "No lyrics found" state.
  - Entry point: a pill next to Like/Follow in Now Playing's `MetaActions`
    row (keeps the 6-button transport row uncrowded).
  - Treat like the queue modal for idle-screensaver purposes — exclude it
    from the idle timer while open (`isIdle = isIdleRaw && !queueOpen && !lyricsOpen`).

## Backlog (not yet scheduled)

- **Persistence** — `followedArtistsStore`, `likedTracksStore`, and
  `settingsStore` (Canvas quality) are in-memory only; everything resets on
  app restart. Needs a storage layer (`@react-native-async-storage/async-storage`
  or a small SQLite file) and load/save wiring in each store.
- **OTA hosting** — `OTA_MANIFEST_URL` is a placeholder
  (`https://REPLACE_ME/...`). Needs: pick a static host (own domain / GitHub
  raw / S3), publish `update.json` + signed release APK there, bump
  `versionCode`/`versionName` in `android/app/build.gradle` on every release.
- **Release signing** — `android/app/build.gradle` currently signs release
  builds with the debug keystore (`signingConfigs.debug`) — fine for sideload
  testing, not for a real release. Needs a proper release keystore before
  OTA-distributed APKs matter in practice.
- **Physical device testing** — everything so far is verified on the
  `opentune_tv11` emulator only. Needs a pass on a real Android TV box/stick:
  remote-specific input quirks, actual throughput for Canvas/audio buffering,
  real install-permission flow for OTA (the emulator test used `adb shell
  appops set ... allow` to skip the manual toggle).
  - A real device will ALSO need to check whether the dev-only SOCKS5
    workaround is needed at all — it exists only because this cloud dev
    environment's IP is blocked by YouTube; a real end-user's IP almost
    certainly isn't, and the proxy is gated `BuildConfig.DEBUG` anyway so
    this should be a non-issue, but worth confirming on first real-device run.
- **Error/retry UX for playback** — `StreamResolver` failures surface as a
  plain error string in Now Playing (`state.error`); no retry button, no
  automatic skip-to-next-on-failure for a bad resolve.
- **Mix/playlist queue resolution edge cases** — `resolveMixQueue` caps at
  `MIX_QUEUE_LIMIT=50`; not yet tested against very large or very short
  (single-track) mixes.
- **Accessibility / TalkBack** — not audited; TV accessibility services pass
  hasn't been done.

## Explicitly out of scope (by prior decision)

- iOS / mobile — Android TV only, user ruled this out explicitly.
- Any form of login/account — all personalization must stay local-only.
- Expo / Expo Go — the project is bare React Native CLI with a custom native
  module and the `react-native-tvos` fork; neither is compatible with Expo
  Go's fixed runtime, and switching to Expo-managed workflow isn't planned.
