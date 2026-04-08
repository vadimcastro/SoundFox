# SoundFox v2.0 Roadmap

## Goal
Ship a major architecture upgrade centered on richer EQ controls and cleaner extension-level command handling, while preserving cross-browser behavior.

## Current Baseline (v1.3.5)
Already implemented:
- Per-site settings storage model (`settings[hostname]`)
- Per-tab temporary scope (`sessionStorage`)
- Flat/Bass EQ, Dialog mode, Auto-Level mode
- Popup + content-script message flow

This means v2 should focus on true major capability expansion, not re-implementing the current baseline.

## Proposed v2.0 Scope

### 1. Full 5-Band EQ System
- Replace single lowshelf toggle with five peaking bands (`60Hz`, `300Hz`, `1kHz`, `3kHz`, `12kHz`).
- Persist per-band gains in storage.
- Update messaging contract from string EQ modes to structured payloads.

Example shape:
```json
{
  "eqBands": [4, 2, 0, -2, -4]
}
```

### 2. Commands API Migration
- Move shortcut handling out of page-level `keydown` listeners.
- Register commands in manifest and handle them in background.
- Dispatch command actions to active tabs via `tabs.sendMessage`.

### 3. Storage Model Hardening
- Introduce explicit schema versioning for stored settings.
- Add migration utilities so upgrades preserve user state safely.
- Normalize host matching strategy (subdomain behavior and fallback rules).

### 4. UI Expansion for EQ Editing
- Add compact but clear 5-band controls in popup.
- Keep mobile-sized popup constraints in mind.
- Provide reset/default presets per band set.

## Suggested Sequence
1. Define new storage schema + migration path.
2. Implement 5-band audio graph in content script.
3. Implement popup EQ UI and messaging integration.
4. Migrate shortcuts to commands API.
5. Add regression checks for state persistence and command routing.

## Versioning Recommendation
- Use `v1.4.x` for incremental hardening (CI/typecheck/commands migration if done with minimal UI scope).
- Reserve `v2.0.0` for release containing full 5-band EQ plus storage/messaging schema changes.
