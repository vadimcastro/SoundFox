# SoundFox 🦊
**Release: v1.3.0**

A powerful, entirely local, hardware-accelerated WebAudio extension that elegantly resolves streaming audio discrepancies (quiet dialogue, deafening action scenes, and massive disparities between episodes or streaming platforms).

## Core Features
*   **Master Volume Override:** Smoothly boost native HTML5 streaming media globally up to 600% beyond hardware maximums.
*   **Auto-Level Node:** Implements a broadcast-grade 5ms C++ `DynamicsCompressorNode` explicitly tied to SPA node swaps natively to flawlessly normalize audio jumps across multi-episode binges (e.g., loud HBO intros) inherently within `<300ms`.
*   **Dialog Component:** Smoothly crushes harsh digital micro-transients while applying precise makeup gain, making muddy dialogue crystal clear dynamically.
*   **Zero-CPU Footprint:** Operates independently of JavaScript interval math, rendering fully locally inside the browser's C++ hardware threads to completely eliminate background battery throttling.
*   **Preset Shortcuts:** Utilize `0-6` keyboard triggers bound seamlessly across native DOM environments via the overlay menu.

## Development & Build Instructions
Built inside a robust Vite + Vanilla TypeScript environment, compiling straight into declarative V3/V2 Cross-Browser manifests.

```bash
# Install dependencies
npm install

# Build for Google Chrome (Manifest V3)
npm run build:chrome

# Build for Mozilla Firefox (Manifest V2)
npm run build:firefox
```
*Compiled unpacked extensions will natively populate directly into the local `/dist/` folder.*

## Future Roadmap (V2.0.0)
Refer internally to `V2_ROADMAP.md` for architectural blueprints detailing the upcoming implementation processes covering domain-isolated storage caches, a full 5-band peaking graphic EQ cascade, and explicit `chrome.commands` OS overrides!
