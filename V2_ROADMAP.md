# SoundFox v2.0 Roadmap

## Goal
Ship a major architecture upgrade centered on richer EQ controls and cleaner extension-level command handling, while preserving cross-browser behavior.

## Why v2.0 Matters
- Delivers meaningful user-facing audio control: a real 5-band EQ moves SoundFox from simple boosting to tunable sound shaping.
- Reduces support risk during upgrades: explicit schema versioning and migrations prevent user state loss and inconsistent behavior.
- Improves reliability on real browsing surfaces: stronger host matching and URL edge-case handling make settings more predictable across tabs, subdomains, and special pages.
- Creates a safer evolution path: typed messaging and validation lower regression risk as features grow.
- Makes work parallelizable and trackable: task-to-issue conversion with acceptance criteria supports faster execution and clearer ownership.
- Positions the project for a clean `2.0.0` launch instead of incremental feature drift.

## Current Baseline (v1.4.0)
Already implemented:
- Per-site settings storage model (`settings[siteKey]` with hostname/origin fallback)
- Per-tab temporary scope (`sessionStorage`)
- Flat/Bass EQ, Dialog mode, Auto-Level mode
- Popup + content-script message flow
- Extension command-based preset shortcuts
- CI typecheck gate (`tsc --noEmit`)

This means v2 should focus on true major capability expansion, not re-implementing the current baseline.

## v2.0 Implementation Task List

### 1. Schema and Migration Foundation
- Define `settingsSchemaVersion` and typed `SoundFoxSettingsV2`.
- Add `eqBands` as a five-slot numeric tuple with safe defaults.
- Implement migration pipeline for legacy and v1 storage shapes into v2.
- Add migration tests for missing/corrupt/partial persisted data.

### 2. Audio Engine Refactor for 5-Band EQ
- Replace the single lowshelf node with five peaking filters (`60Hz`, `300Hz`, `1kHz`, `3kHz`, `12kHz`).
- Define deterministic DSP graph order with `Dialog` and `Level` modes.
- Add gain clamping policy for each band.
- Ensure SPA/media rebind paths preserve live EQ state.

### 3. Messaging Contract v2
- Add message actions for `setEqBands`, `getStateV2`, and `resetEqPreset`.
- Keep temporary compatibility for current string-based EQ actions during transition.
- Validate message payloads and reject malformed updates safely.

### 4. Popup UI Expansion
- Replace the current Balanced/Bass toggle with five EQ band controls.
- Add quick presets (`Balanced`, `Bass Boost`, `Dialog Focus`, `Reset`).
- Keep popup layout within compact browser extension constraints.
- Make memory scope effects clear near EQ controls.

### 5. Scope and Host Matching Consistency
- Finalize canonical site-key behavior and subdomain inheritance policy.
- Align all persistence read/write paths to one shared resolver.
- Add edge-case handling tests for `about:blank`, `file:`, and restricted URLs.

### 6. Shortcut and Command Follow-Through
- Keep volume commands stable.
- Optionally add command actions for EQ preset cycling/reset.
- Document default bindings and remapping behavior for Firefox and Chrome.

### 7. Testing and QA
- Add unit coverage for migration and settings coercion utilities.
- Add integration checks for popup/background/content message flow.
- Run manual site matrix validation on major streaming targets.
- Maintain regression checks for mute, memory scope, and mode interactions.

### 8. Release and Rollout
- Update docs and release notes for v2 behavior changes.
- Bump version metadata to `2.0.0`.
- Validate Firefox/Chrome bundles before submission.
- Tag `v2.0.0`, push, create PR, merge, and submit to stores.

## Execution Note
- Before implementation starts, convert each section above into GitHub issues with: clear title, acceptance criteria, dependencies, estimate, and owner.

## Versioning Recommendation
- `v1.4.0` is the hardening release for commands migration, CI typecheck, and persistence robustness.
- Reserve `v2.0.0` for release containing full 5-band EQ plus storage/messaging schema changes.
