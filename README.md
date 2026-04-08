# SoundFox
**Release: v1.3.5**

SoundFox is a local-first browser extension that stabilizes and boosts streaming audio with a lightweight WebAudio pipeline.

## What It Does Today
- Volume boost from `0%` to `600%`
- EQ toggle: `Flat` or `Bass`
- `Dialog` mode for voice clarity
- `Level` mode for loudness smoothing across scenes/episodes
- Per-site and per-tab memory scope
- Popup controls + preset shortcuts (`0-6`, plus `9` for `50%`)

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

## Recommended v1.4 Scope
A focused `v1.4` release should improve reliability and ergonomics without major architecture changes:

1. Move shortcuts from page-level key listeners to extension commands.
- Use `commands` in `manifest.json` plus `browser.commands.onCommand` in background.
- Reduces conflicts with website keybindings and improves user remapping support.

2. Add lightweight automated checks.
- Keep current CI build job.
- Add typecheck/lint (or at minimum a `tsc --noEmit` step) to catch regressions earlier.

3. Harden state persistence edge cases.
- Normalize hostname handling and fallback logic for missing/invalid tab URLs.
- Improve migration behavior for older storage shapes.

4. Improve UX clarity for mode interactions.
- Keep active-state color semantics consistent across popup and badge.
- Add concise helper copy/tooltips for `Dialog` vs `Level` interaction rules.

## v2.0 Direction
For major architectural work (multi-band EQ UI, deeper profile model, and larger messaging changes), see [V2_ROADMAP.md](V2_ROADMAP.md).
