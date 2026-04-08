# SoundFox
**Release: v1.4.0**

SoundFox is a local-first browser extension that stabilizes and boosts streaming audio with a lightweight WebAudio pipeline.

## What It Does Today
- Volume boost from `0%` to `600%`
- EQ toggle: `Balanced` or `Bass`
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

## v1.4.0 Highlights
1. Shortcut migration to extension commands.
- Preset shortcuts now use `manifest.commands` + `browser.commands.onCommand` for better compatibility.
- Popup quick keys (`0-6`, `9`) remain available with hover hints.

2. Automated type safety checks.
- Added `npm run typecheck` (`tsc --noEmit`) and CI enforcement before build.

3. State persistence hardening.
- Added hostname normalization and fallback key strategy for site-scoped settings.
- Added migration from legacy top-level storage keys into the current `settings` shape.
- Improved behavior for tabs with missing or special-case URLs.

4. UX clarity improvements.
- Updated EQ label from `Flat` to `Balanced`.
- Clarified `Dialog` and `Level` interaction text and tooltips in the popup.

## v2.0 Direction
For major architectural work (multi-band EQ UI, deeper profile model, and larger messaging changes), see [V2_ROADMAP.md](V2_ROADMAP.md).
