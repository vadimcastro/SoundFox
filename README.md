# SoundFox
**Release: v1.5.0**

SoundFox is a local-first browser extension that stabilizes and boosts streaming audio with a lightweight WebAudio pipeline.

## What It Does Today
- Volume boost from `0%` to `600%`
- Quick EQ modes: `Balanced` or `Bass`
- Optional Advanced 5-band EQ (collapsible)
- `Dialog` mode for voice clarity
- `Level` mode for loudness smoothing across scenes/episodes
- Per-site and per-tab memory scope
- Popup controls + extension command presets (`Ctrl+Shift+0..6`, plus `Ctrl+Shift+9` for `50%`)

## Tech Stack
- Vite + TypeScript
- WebExtension architecture (popup, content script, background worker)
- Shared browser API via `webextension-polyfill`

## Build
```bash
npm install
npm run build
```

Artifacts:
- Firefox: `dist/firefox`
- Chrome: `dist/chrome`

## CI
GitHub Actions runs install + full build on push and pull requests:
- [ci.yml](.github/workflows/ci.yml)

## v1.5.0 Highlights
1. Advanced EQ upgrade.
- Added 5-band EQ engine support with persisted per-band settings.
- Added collapsible Advanced EQ panel in popup for optional tuning.

2. Popup reliability and interaction fixes.
- Fixed Dialog/Level toggles to resolve from live tab state on click.
- Prevented stale UI toggle state after reload from causing incorrect mode behavior.

3. UX polish and release hardening.
- Improved EQ panel presentation and spacing behavior.
- Kept baseline quick controls (`Balanced`, `Bass`, `Dialog`, `Level`) as primary UX.

## v1.4.0 Highlights
1. Command and interaction hardening.
- Improved extension shortcut handling and preset hints behavior in the popup.
- Stabilized mode behavior across reload and active-tab changes.

2. Firefox submission compatibility fixes.
- Removed unsupported permission usage flagged during AMO review.
- Corrected icon sizing/mapping to expected manifest dimensions.

## Roadmap Status
- v2 baseline work is already underway (schema versioning + 5-band engine + scoped settings normalization).
- Remaining major items: messaging v2 completion, automated migration/edge-case tests, and final EQ UX decision.
- Active planning and execution tracker: [V2_ROADMAP.md](V2_ROADMAP.md).

## v2.0 Direction
For major architectural work (multi-band EQ UI, deeper profile model, and larger messaging changes), see [V2_ROADMAP.md](V2_ROADMAP.md).
