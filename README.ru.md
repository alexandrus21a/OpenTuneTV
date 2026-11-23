# OpentuneRN

Музыкальное приложение для Android TV, которое стримит реальное аудио из
YouTube Music — без API-ключа, без аккаунта Google/YouTube, вообще без
логина. Переписано на React Native (`react-native-tvos`) с более раннего
Kotlin/Compose-приложения, с сохранением той же идеи: NewPipeExtractor +
неавторизованный клиент YouTube Music Innertube как нативный мост, а всё
остальное — на React Native, под D-pad-навигацию Android TV.

**Только Android TV.** Без телефона/планшета/iOS.

🇬🇧 English version: [README.md](README.md)

## Возможности

- **Каталог и Главная** — реальные полки YouTube Music Home, без ключа и логина.
- **Поиск** — сначала пробует собственный поиск песен YouTube Music (чистые
  названия, квадратные обложки), падает на обычный видео-поиск только если
  музыкальный поиск пуст.
- **Реальное воспроизведение** — резолвинг только аудиопотоков (никогда не
  видео) через NewPipeExtractor, проигрывается через `react-native-video`.
- **Очередь** — полностью редактируемая очередь (перестановка, удаление) в
  отдельном модальном окне, shuffle, repeat (off/all/one).
- **Персонализация без аккаунта** — локальные Like и Follow, на основе которых
  на Главной строятся полки "Liked Songs" и "Because you follow {artist}".
- **Canvas-фоны** — короткое беззвучное зацикленное видео позади экрана Now
  Playing (в духе Spotify Canvas), с настройкой качества (Off / Low / High) в
  Settings. При выключенном Canvas, ошибке резолва или его отсутствии для
  трека — фолбэк на блюрный фон из обложки.
- **Скринсейвер при простое** — через ~18 секунд без ввода с пульта контролы
  на Now Playing плавно гаснут, остаётся только Canvas/обложка и небольшая
  подпись; любое нажатие пульта мгновенно возвращает интерфейс.
- **OTA-обновления внутри приложения** — так как приложение не распространяется
  через магазин, оно умеет проверять небольшой JSON-манифест, скачивать более
  новый APK и передавать его системному установщику — всё из Settings.
- TV-нативный интерфейс: фокус через D-pad везде, настоящие векторные иконки
  (без эмодзи), отклик по нажатию (а не по отпусканию), сдержанная анимация,
  асимметричный тайминг (быстрое пробуждение / медленное засыпание) по
  принципам Apple и Emil Kowalski.

## Архитектура

```
src/
  screens/       Home, NowPlaying, Search, Settings
  components/    GlobalAudioPlayer, TrackCard, MiniTrackCard, Sidebar,
                 CanvasBackground, UpdateSection
  store/         playerStore, settingsStore, followedArtistsStore,
                 likedTracksStore (все на useSyncExternalStore, только в памяти)
  hooks/         useIdle (скринсейвер)
  native/        JS-обёртки над нативными bridge-модулями

android/app/src/main/java/com/opentunern/newpipe/
  OkHttpDownloader, NewPipeBootstrap   инфраструктура NewPipeExtractor
  Innertube, InnertubeModels,
  InnertubeParser, TitleCleanup        неавторизованный клиент YouTube Music
  CatalogRepository                    полки / поиск / резолв mix-очередей
  StreamResolver                       выбор аудио- и видео-only потоков
  NewPipeModule, NewPipePackage        RN-мост (NativeModule)
  ProxyConfig                          dev-only SOCKS5-прокси, под BuildConfig.DEBUG
  OtaModule                            проверка манифеста / скачивание / установка
```

Весь нативный Kotlin-слой отвечает за работу с YouTube (без API-ключа — точно
как в оригинальном Compose-приложении); React Native отвечает за все экраны,
очередь, настройки и модель взаимодействия с пультом ТВ.

## Требования

- Bun (пакетный менеджер; **не** npm/yarn/pnpm)
- JDK 17, Android SDK (`compileSdk`/`targetSdk` — см. `android/build.gradle`)
- Устройство или эмулятор Android TV (рекомендуется API 30+)

## Запуск

```bash
bun install
bun start                       # Metro dev-сервер
bun run android                 # или: cd android && ./gradlew :app:installDebug
```

Проверка типов: `bunx tsc -p tsconfig.json --noEmit`

Изменения только в нативном слое (всё под `android/app/src/main/java/...` или
`AndroidManifest.xml`) требуют пересборки (`./gradlew :app:assembleDebug
--no-daemon`) и переустановки APK. Чисто JS/TSX-изменения подхватываются
Metro "на лету" — пересборка не нужна.

## OTA-обновления

`src/native/OtaModule.ts` экспортирует `OTA_MANIFEST_URL`, сейчас это
placeholder (`https://REPLACE_ME/...`). Чтобы включить обновления, разместите
небольшой JSON-файл на любом статическом хостинге (свой домен, GitHub raw,
S3, ...) и подставьте его URL в эту константу:

```json
{
  "versionCode": 2,
  "versionName": "1.1",
  "apkUrl": "https://example.com/opentune-rn/app-release.apk",
  "notes": "Что изменилось в этом релизе"
}
```

Приложение сравнивает `versionCode` манифеста с установленной сборкой и
предлагает скачать обновление только если манифестный номер больше.

## Известные пробелы

- Настройки Like/Follow и качества Canvas хранятся только в памяти — сбрасываются
  при перезапуске приложения (слоя персистентности пока нет).
- `OTA_MANIFEST_URL` нужно указать на реальный хостинг, иначе обновления не
  заработают за пределами тестов.
- Тексты песен (синхронизированный показ в духе Musixmatch) — запланированная,
  но пока не реализованная фича.
- Проверено только на эмуляторе Android TV; тестов на реальном устройстве
  ещё не было.

Подробный и актуальный разбор — в `STATUS.md` и `PLAN.md`.
