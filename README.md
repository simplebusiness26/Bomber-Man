# Blast Grid

**Blast Grid** is an original mobile grid-bomb action game built to capture the fast, readable feel of classic 16-bit maze bombers without copying protected characters, maps, art, music or branding.

The GitHub repository is currently named `Bomber-Man` as a working project name. The shipping identity in the app is **Blast Grid**.

## What is playable

- 30-stage campaign across 5 visual sectors, with a boss stage every 6 levels.
- Classic cross-shaped blast propagation, destructible blocks, solid grid walls and bomb chain reactions.
- Five bomb technologies: Fuse, Pulse (remote), Pierce, Frost and Mine.
- Upgrades for blast range, simultaneous bombs, movement speed, shields, lives and bomb kicking.
- Five regular enemy behaviours plus sector Wardens.
- Enemy turrets and hostile bombs, hidden exits, score, lives, stage progression and persistent save data.
- Landscape touchscreen controls plus keyboard controls for desktop testing.
- Original procedural visuals and procedural WebAudio sound cues; no copyrighted Bomberman assets are included.
- Offline PWA support and an Android APK build pipeline.

## Controls

### Touch
- D-pad: move.
- **DROP**: place the selected bomb.
- **TYPE**: cycle unlocked bomb technology.
- **ACTION**: remotely detonate the oldest Pulse bomb.
- Walk into a bomb after collecting **KICK** to send it sliding.

### Keyboard
- Arrow keys: move.
- `Space` / `Z`: drop bomb.
- `Enter`: cycle bomb type.
- `X`: action / remote trigger.
- `Esc`: pause.

## Android APK

Every push to `main` that changes game files runs tests and builds an Android debug APK. The workflow uploads the APK as an Actions artifact and updates the `android-latest` GitHub Release with `blast-grid-debug.apk`.

No paid API, backend, account, analytics SDK or cloud service is required to play or build the game.

## Local web test

Serve the repository with any static HTTP server and open `index.html`. ES modules require HTTP rather than opening the file directly on some browsers.

## Project structure

- `src/core.js` – deterministic campaign/stage generation and core grid helpers.
- `src/game.js` – gameplay engine, enemies, bombs, progression, canvas rendering, input, audio and save state.
- `index.html` / `styles.css` – mobile shell and touch controls.
- `tests/` – campaign and stage-generation smoke tests.
- `.github/workflows/android-apk.yml` – test, Android build, artifact and release pipeline.

## IP position

This project is a spiritual successor, not a clone distribution. It intentionally does **not** include Konami/Hudson characters, sprites, level layouts, logos, names, music or extracted game data. Before a public store launch, the repository itself should also be renamed away from `Bomber-Man` to the shipping title.

## License

MIT — see `LICENSE`.
