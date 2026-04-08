import browser from "webextension-polyfill";
import type { PopupToContentMessage, SoundFoxStateV2 } from "./messages";
import {
  EQ_BAND_FREQUENCIES,
  DEFAULT_EQ_BANDS,
  SETTINGS_SCHEMA_VERSION,
  coerceSettings,
  getPrimarySiteStorageKey,
  getSiteStorageCandidates,
  hasAnySetting,
  normalizeSiteSettings,
  resolveEqBandsForMode,
  type EqBandsTuple,
  type EqMode,
  type MemoryScope,
  type PersistedSettingsV2
} from "./settings";

console.log("SoundFox Content Script attached.");

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let eqFilters: BiquadFilterNode[] = [];
let compressorNode: DynamicsCompressorNode | null = null;
let levelerNode: DynamicsCompressorNode | null = null;
const mediaElements = new Set<HTMLMediaElement>();

let currentVolume = 1;
let currentEq: EqMode = "flat";
let currentDialogMode = false;
let currentAutoLevel = false;
let currentEqBands: EqBandsTuple = [...DEFAULT_EQ_BANDS];
let currentMemoryScope: MemoryScope = "site";

function applyStatePatch(patch: PersistedSettingsV2) {
  if (patch.volume !== undefined) currentVolume = patch.volume;
  if (patch.eq !== undefined) currentEq = patch.eq;
  if (patch.dialogMode !== undefined) currentDialogMode = patch.dialogMode;
  if (patch.autoLevel !== undefined) currentAutoLevel = patch.autoLevel;
  if (patch.eqBands !== undefined) {
    currentEqBands = patch.eqBands;
  } else if (patch.eq !== undefined) {
    currentEqBands = resolveEqBandsForMode(patch.eq);
  }
}

function applyEqBandGains() {
  if (!eqFilters.length) return;
  for (let i = 0; i < eqFilters.length; i += 1) {
    eqFilters[i].gain.value = currentEqBands[i] ?? 0;
  }
}

// Save helper for domain-specific settings
async function saveSettings() {
  if (currentMemoryScope === "tab") {
    sessionStorage.setItem("soundfox_tab_state", JSON.stringify({
      volume: currentVolume,
      eq: currentEq,
      dialogMode: currentDialogMode,
      autoLevel: currentAutoLevel,
      eqBands: currentEqBands
    }));
    return;
  }

  const siteKey = getPrimarySiteStorageKey(window.location);
  try {
    const siteCandidates = getSiteStorageCandidates(window.location);
    const data = await browser.storage.local.get(["settings", "settingsSchemaVersion"]);
    const normalized = normalizeSiteSettings({
      rawSettings: data.settings,
      siteCandidates,
      siteKey
    });
    const settings = normalized.settingsMap;
    settings[siteKey] = {
      volume: currentVolume,
      eq: currentEq,
      dialogMode: currentDialogMode,
      autoLevel: currentAutoLevel,
      eqBands: currentEqBands
    };
    await browser.storage.local.set({
      settings,
      settingsSchemaVersion: SETTINGS_SCHEMA_VERSION
    });
  } catch (e) {}
}

// Async init variables from storage to ensure state persists across video/episode reloads
try {
  browser.storage.local.get([
    "settings",
    "memoryScope",
    "settingsSchemaVersion",
    "volume",
    "eq",
    "dialogMode",
    "autoLevel"
  ]).then((data) => {
    currentMemoryScope = data.memoryScope === "tab" ? "tab" : "site";
    
    let scopedSettings: PersistedSettingsV2 = {};
    if (currentMemoryScope === "tab") {
      const tabData = sessionStorage.getItem("soundfox_tab_state");
      if (tabData) {
        try { scopedSettings = coerceSettings(JSON.parse(tabData)); } catch(e){}
      }
    } else {
      const siteKey = getPrimarySiteStorageKey(window.location);
      const siteCandidates = getSiteStorageCandidates(window.location);
      const normalized = normalizeSiteSettings({
        rawSettings: data.settings,
        siteCandidates,
        siteKey,
        legacy: {
          volume: data.volume,
          eq: data.eq,
          dialogMode: data.dialogMode,
          autoLevel: data.autoLevel
        }
      });
      scopedSettings = normalized.scoped;

      if (normalized.didMutate || data.settingsSchemaVersion !== SETTINGS_SCHEMA_VERSION) {
        browser.storage.local
          .set({
            settings: normalized.settingsMap,
            settingsSchemaVersion: SETTINGS_SCHEMA_VERSION
          })
          .catch(() => {});
      }

      const legacy = coerceSettings({
        volume: data.volume,
        eq: data.eq,
        dialogMode: data.dialogMode,
        autoLevel: data.autoLevel
      });
      if (hasAnySetting(legacy)) {
        browser.storage.local
          .remove(["volume", "eq", "dialogMode", "autoLevel"])
          .catch(() => {});
      }
    }

    applyStatePatch(scopedSettings);
    
    if (audioCtx) {
      if (gainNode) gainNode.gain.value = currentVolume;
      applyEqBandGains();
      updateGraphRouting();
    }
  }).catch(() => {});
} catch (e) {}

// Multi-DOM Synchronizer: Pipes updates from root frame to embedded <iframe> video containers
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.memoryScope && changes.memoryScope.newValue !== undefined) {
    currentMemoryScope = changes.memoryScope.newValue as "site" | "tab";
  }

  if (currentMemoryScope === "tab") return; // Tab scopes natively do not synchronize backwards globally!

  if (area === "local" && changes.settings && changes.settings.newValue) {
    const siteCandidates = getSiteStorageCandidates(window.location);
    const siteKey = getPrimarySiteStorageKey(window.location);
    const normalizedNew = normalizeSiteSettings({
      rawSettings: changes.settings.newValue,
      siteCandidates,
      siteKey
    });
    const normalizedOld = normalizeSiteSettings({
      rawSettings: changes.settings.oldValue,
      siteCandidates,
      siteKey
    });
    
    const hostSettings = normalizedNew.scoped;
    const oldHostSettings = normalizedOld.scoped;

    if (hostSettings.volume !== undefined && hostSettings.volume !== oldHostSettings.volume) {
      currentVolume = hostSettings.volume;
      if (gainNode) gainNode.gain.value = currentVolume;
    }
    if (hostSettings.eqBands !== undefined && hostSettings.eqBands !== oldHostSettings.eqBands) {
      currentEqBands = hostSettings.eqBands;
      applyEqBandGains();
    }
    if (hostSettings.eq !== undefined && hostSettings.eq !== oldHostSettings.eq) {
      currentEq = hostSettings.eq;
      if (hostSettings.eqBands === undefined) {
        currentEqBands = resolveEqBandsForMode(currentEq);
        applyEqBandGains();
      }
    }
    if (hostSettings.dialogMode !== undefined && hostSettings.dialogMode !== oldHostSettings.dialogMode) {
      currentDialogMode = hostSettings.dialogMode;
      updateGraphRouting();
    }
    if (hostSettings.autoLevel !== undefined && hostSettings.autoLevel !== oldHostSettings.autoLevel) {
      currentAutoLevel = hostSettings.autoLevel;
      updateGraphRouting();
    }
  }
});

function updateGraphRouting() {
  if (!eqFilters.length || !compressorNode || !levelerNode || !gainNode) return;
  
  // Decouple everything to reset baseline
  eqFilters.forEach((filter) => filter.disconnect());
  compressorNode.disconnect();
  levelerNode.disconnect();

  for (let i = 0; i < eqFilters.length - 1; i += 1) {
    eqFilters[i].connect(eqFilters[i + 1]);
  }

  let lastNode: AudioNode = eqFilters[eqFilters.length - 1];
  
  if (currentDialogMode) {
    lastNode.connect(compressorNode);
    lastNode = compressorNode;
  }
  
  if (currentAutoLevel) {
    lastNode.connect(levelerNode);
    lastNode = levelerNode;
  }
  
  lastNode.connect(gainNode);
}

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new window.AudioContext();
    gainNode = audioCtx.createGain();
    eqFilters = EQ_BAND_FREQUENCIES.map((frequency, index) => {
      const filter = audioCtx!.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = frequency;
      filter.Q.value = 1;
      filter.gain.value = currentEqBands[index] ?? 0;
      return filter;
    });
    compressorNode = audioCtx.createDynamicsCompressor();
    levelerNode = audioCtx.createDynamicsCompressor();

    // Dialog Mode (Micro-dynamics: Soften hard peaks, boost dialogue)
    compressorNode.threshold.value = -45; 
    compressorNode.knee.value = 30;
    compressorNode.ratio.value = 15; 
    compressorNode.attack.value = 0.005;
    compressorNode.release.value = 0.25;

    // Auto-Level Mode (Macro-dynamics: Ride the fader evenly across entire episodes)
    levelerNode.threshold.value = -35;
    levelerNode.knee.value = 25;
    levelerNode.ratio.value = 4;
    levelerNode.attack.value = 0.005; // Lightning fast 5ms transient crush absolutely protecting ears from blasts
    levelerNode.release.value = 1.0;

    // Terminal output connection. Upstream routing is handled in updateGraphRouting.
    gainNode.connect(audioCtx.destination); 
    applyEqBandGains();
    updateGraphRouting();
  }
}

function bindMediaElement(el: HTMLMediaElement) {
  if (mediaElements.has(el)) return;
  initAudioContext();
  if (audioCtx && eqFilters.length) {
    try {
      const source = audioCtx.createMediaElementSource(el);
      source.connect(eqFilters[0]);
      mediaElements.add(el);
      
      if (gainNode) gainNode.gain.value = currentVolume;
      applyEqBandGains();
      updateGraphRouting();
      
      // Bind seamlessly to SPA episode jumps to explicitly map variables
      el.addEventListener('loadeddata', () => {
        if (gainNode) gainNode.gain.value = currentVolume;
        applyEqBandGains();
        updateGraphRouting();
      });
      
      console.log("SoundFox: Secured actively playing media pipeline.");
    } catch (e) {
      // Failsafe for natively locked elements
    }
  }
}

function attachToMediaElements() {
  const elements = document.querySelectorAll<HTMLMediaElement>("video, audio");
  elements.forEach((el) => {
    // ONLY bind to actively playing elements!
    // This effortlessly isolates YouTube's hidden preloader ghosts natively without DSP interval hacks.
    if (!el.paused) {
      bindMediaElement(el);
    } else {
      el.addEventListener('play', () => {
        bindMediaElement(el);
      }, { once: true });
    }
  });
}

// Initial attachment
attachToMediaElements();

// Observe dynamically added media elements (e.g. infinite scroll feeds, SPAs)
const observer = new MutationObserver(() => {
  attachToMediaElements();
});
observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from the Popup (Always hits the outer Top Frame)
function isPopupMessage(message: unknown): message is PopupToContentMessage {
  return Boolean(message && typeof message === "object" && "action" in message);
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isPopupMessage(message)) return;

  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  if (message.action === "setVolume") {
    currentVolume = message.value;
    saveSettings();
    if (gainNode && audioCtx) {
      if (message.value === 0) {
        mediaElements.forEach(el => el.muted = true);
        gainNode.gain.value = 0;
      } else {
        mediaElements.forEach(el => el.muted = false);
        gainNode.gain.value = message.value;
      }
    }
  } else if (message.action === "setEq") {
    const nextMode: EqMode = message.mode === "bass" ? "bass" : "flat";
    currentEq = nextMode;
    currentEqBands = resolveEqBandsForMode(nextMode);
    saveSettings();
    applyEqBandGains();
  } else if (message.action === "setEqBands") {
    const nextSettings = coerceSettings({ eqBands: message.bands });
    if (!nextSettings.eqBands) return;
    currentEq = "flat";
    currentEqBands = nextSettings.eqBands;
    saveSettings();
    applyEqBandGains();
  } else if (message.action === "setDialogMode") {
    currentDialogMode = message.active;
    if (currentDialogMode) {
      currentEq = "flat";
      currentEqBands = [...DEFAULT_EQ_BANDS];
      applyEqBandGains();
    }
    saveSettings();
    if (compressorNode && eqFilters.length && gainNode && audioCtx) {
      updateGraphRouting();
    }
  } else if (message.action === "setAutoLevel") {
    currentAutoLevel = message.active;
    if (currentAutoLevel) {
      currentEq = "flat";
      currentEqBands = [...DEFAULT_EQ_BANDS];
      applyEqBandGains();
    }
    saveSettings();
    if (levelerNode && eqFilters.length && gainNode && audioCtx) {
      updateGraphRouting();
    }
  } else if (message.action === "setMemoryScope") {
    currentMemoryScope = message.scope;
    try { browser.storage.local.set({ memoryScope: currentMemoryScope }); } catch(e) {}
    saveSettings();
  } else if (message.action === "getState") {
    const state: SoundFoxStateV2 = {
      volume: currentVolume,
      eq: currentEq,
      eqBands: currentEqBands,
      dialogMode: currentDialogMode,
      autoLevel: currentAutoLevel,
      memoryScope: currentMemoryScope
    };
    return Promise.resolve(state);
  }
});
