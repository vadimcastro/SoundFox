# SoundFox v2.0 Roadmap

Last updated: `2026-04-08`

## Goal
Ship a major architecture upgrade centered on richer EQ controls and cleaner extension-level command handling, while preserving cross-browser behavior.

## Why v2.0 Matters
- Delivers meaningful user-facing audio control: a real 5-band EQ moves SoundFox from simple boosting to tunable sound shaping.
- Reduces support risk during upgrades: explicit schema versioning and migrations prevent user state loss and inconsistent behavior.
- Improves reliability on real browsing surfaces: stronger host matching and URL edge-case handling make settings more predictable across tabs, subdomains, and special pages.
- Creates a safer evolution path: typed messaging and validation lower regression risk as features grow.
- Makes work parallelizable and trackable: task-to-issue conversion with acceptance criteria supports faster execution and clearer ownership.
- Positions the project for a clean `2.0.0` launch instead of incremental feature drift.

## Progress Snapshot
Status legend:
- `[x]` Completed
- `[~]` In progress
- `[ ]` Not started

### Since v1.4.0 and v1.5.0
- `[x]` Advanced 5-band EQ support is live in engine and popup (collapsible by default).
- `[x]` `settingsSchemaVersion` and typed settings coercion are in place (`SETTINGS_SCHEMA_VERSION = 2`).
- `[x]` Legacy-to-scoped settings normalization path exists for site-scoped persistence.
- `[x]` Canonical site candidate resolution includes normalized host, subdomain fallback, origin fallback, and default key.
- `[x]` Dialog/Level toggle handling corrected to use live state and avoid unintended dual toggles.
- `[x]` Popup layout hardening completed for no-cutoff rendering with tighter spacing.
- `[x]` Firefox packaging warnings resolved (`tabCapture` removed, fixed 16/48/128 icon mapping).

## v2.0 Workstreams

### 1. Schema and Migration Foundation
- `[x]` Define `settingsSchemaVersion` and typed v2 settings model.
- `[x]` Add `eqBands` as a five-slot numeric tuple with safe defaults.
- `[~]` Migration pipeline for all legacy/v1 shapes is partially implemented via normalization.
- `[ ]` Add migration tests for missing/corrupt/partial persisted data.

### 2. Audio Engine Refactor for 5-Band EQ
- `[x]` Replace single lowshelf with five peaking filters (`60Hz`, `300Hz`, `1kHz`, `3kHz`, `12kHz`).
- `[x]` Deterministic graph order for EQ -> Dialog compressor -> Level compressor -> Gain.
- `[x]` Gain clamping policy for each EQ band.
- `[x]` SPA/media rebind path preserves live EQ state.

### 3. Messaging Contract v2
- `[x]` `setEqBands` action implemented.
- `[~]` Backward compatibility with existing `setEq`/`getState` flow retained.
- `[ ]` Add formal `getStateV2` action.
- `[ ]` Add `resetEqPreset` action.
- `[ ]` Add stricter payload validation/error responses across message handlers.

### 4. Popup UI Expansion
- `[~]` 5-band controls delivered in an expandable advanced section.
- `[x]` Preset state reflection in EQ summary (`Balanced`, `Bass Boost`, `Dialog Focus`, `Custom`).
- `[ ]` Add explicit quick preset buttons (`Balanced`, `Bass Boost`, `Dialog Focus`, `Reset`) inside advanced EQ.
- `[x]` Memory scope control is co-located and visible near EQ area.

### 5. Scope and Host Matching Consistency
- `[x]` Canonical site-key candidate strategy implemented.
- `[~]` Persistence read/write largely uses shared resolver utilities.
- `[ ]` Add explicit tests for `about:blank`, `file:`, and restricted URLs.

### 6. Shortcut and Command Follow-Through
- `[x]` Volume command presets are stable (`0`, `50`, `100`-`600`).
- `[ ]` Optional keyboard command actions for EQ preset cycling/reset.
- `[ ]` Document default bindings and remapping behavior for Firefox and Chrome.

### 7. Testing and QA
- `[ ]` Add unit tests for migration/coercion utilities.
- `[ ]` Add integration tests for popup/background/content message flow.
- `[~]` Manual regression checks are active, but not yet formalized as a repeatable matrix.
- `[ ]` Add explicit regression checklist for mute, memory scope, EQ, Dialog, and Level interactions.

### 8. Release and Rollout
- `[~]` v1 bridge releases complete (`v1.4.0`, `v1.5.0`), continuing hardening while v2 closes gaps.
- `[ ]` Finalize v2 docs and release notes.
- `[ ]` Bump metadata to `2.0.0`.
- `[ ]` Validate Firefox/Chrome bundles and store checklists.
- `[ ]` Tag `v2.0.0`, push, PR, merge, and submit.

## Revised Next Steps
1. Add automated tests for `src/settings.ts` migration/coercion paths and host key resolution edge cases.
2. Implement messaging v2 completion (`getStateV2`, `resetEqPreset`, stricter payload validation) while preserving current compatibility.
3. Decide on final v2 EQ UX: keep advanced-only model or add explicit quick preset row inside advanced panel.
4. Write browser-specific shortcut docs and confirm command remap behavior in Firefox and Chrome.
5. Run a documented manual QA matrix (YouTube, Netflix, Spotify web, Twitch, mixed tab scenarios).
6. Freeze scope, bump to `2.0.0`, and execute release checklist.

## GitHub Issues Format (Required)
Create each v2 task as a single issue using this format:
- `Title`: `[V2] <workstream> - <specific outcome>`
- `Problem`: one paragraph describing current risk/gap.
- `Scope`: exact files/modules included and excluded.
- `Acceptance Criteria`: checklist of observable pass conditions.
- `Dependencies`: blocking issues/PRs.
- `Estimate`: S/M/L.
- `Owner`: assignee.
- `Validation`: test plan (automated + manual).

## Versioning Recommendation
- `v1.5.0` remains the hardening + UX bridge release.
- `v2.0.0` should ship only after messaging v2 completion plus migration/host-matching test coverage.
