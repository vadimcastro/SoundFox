# SoundFox V2 Architectural Roadmap

## Proposed Versioning: v2.0.0
Given the massive scope of the upcoming upgrades—specifically fundamentally altering the core data storage structure and expanding the underlying C++ WebAudio graph topology natively—these features represent a major architectural shift warranting a definitive **v2.0.0** Major System Upgrade.

---

## 1. Domain-Specific Memory Profiles (Per-Site Saving)
Currently, `browser.storage.local` persists a flat, global state (e.g., `{ volume: 1.5 }`). This intrinsically forces unintended overrides when natively switching contexts between isolated platforms (e.g., a quiet Bflix movie vs. an explosive YouTube video). V2 will implement a URL-keyed nested storage matrix algorithm mapping variables to hosts natively.

### Execution Blueprint:
*   **Popup / Background Polling:** The Extension Popup `main.ts` must definitively query the active tab's hostname string (`new URL(tab.url).hostname`) prior to dispatching state commands globally.
*   **Nested Dictionary Storage Arrays:** 
    Modify all `browser.storage.local.set` functions to strictly manipulate a targeted host-level dictionary natively:
    ```json
    {
      "settings": {
        "youtube.com": { "volume": 1.0, "eq": "flat", "dialogMode": false },
        "bflix.sh": { "volume": 4.0, "eq": "flat", "dialogMode": true }
      }
    }
    ```
*   **Content Script Hydration Check:** Update the initialization framework in `content.ts` to instantly parse `window.location.hostname` upon episodic binding sequences natively extracting exclusively its own configuration variables dynamically!

---

## 2. 5-Band Graphic Equalizer
Expanding the binary `Flat`/`Bass` graphical toggle into a heavily comprehensive 5-band C++ graphic equalizer natively utilizing cascaded peaking filters across the WebAudio API audio thread matrices.

### Execution Blueprint:
*   **Context Hardware Expansion:** Inside `content.ts -> initAudioContext()`, physically replace the singular `biquadFilter` variable with a sequential array of standard `BiquadFilterNode` objects specifically configured as `.type = "peaking"` hardware filters locked onto exact frequency ranges (e.g., `60Hz`, `300Hz`, `1kHz`, `3kHz`, `12kHz`).
*   **UI Overlay Transformation:** Design a secondary graphical tray inside the `index.html` DOM utilizing vertical-rotated `<input type="range">` elements natively mapping exact dB variations across `-15dB` to `+15dB`.
*   **IPC Payload Updates:** Modify the `setEq` messaging payload structure from a static text string (e.g., `"bass"`) explicitly to a payload array buffer natively (e.g., `[10, 5, 0, -2, -5]`).

---

## 3. Dedicated Hardware Command Shortcuts
Currently, volume presets (`0-6`) are rigidly hardcoded utilizing native `document.addEventListener('keydown')` DOM listeners inherently injected straight into the active webpage. While functional, it risks blocking embedded media key binds natively. V2 explicitly migrates all inputs exclusively to the `chrome.commands` WebExtension API logic.

### Execution Blueprint:
*   **Manifest Registration Rules:** Map explicit hardware hooks natively straight into `manifest.json` under the official `"commands"` property, linking them fundamentally to extension-level background directives.
*   **Background Hook Dispatcher:** Deploy `browser.commands.onCommand` listeners inside `background.ts`. When triggered natively by the OS, explicitly dispatch `browser.tabs.sendMessage(..., { action: 'setVolume' })` straight into the isolated content script payload natively.
*   **User Modifiability:** Operating specifically on the `"commands"` API natively forces modern Chrome and Firefox browsers to automatically inject a visual "Keyboard Shortcuts" UI panel directly inside the extension's settings page, legally and dynamically permitting the user to physically override and construct their own macro presets!
