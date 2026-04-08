import browser from "webextension-polyfill";

console.log("SoundFox Content Script attached.");

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let biquadFilter: BiquadFilterNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;
let levelerNode: DynamicsCompressorNode | null = null;
const mediaElements = new Set<HTMLMediaElement>();

let currentVolume = 1;
let currentEq = "flat";
let currentDialogMode = false;
let currentAutoLevel = false;
let currentMemoryScope: "site" | "tab" = "site";

type PersistedSettings = {
  volume?: number;
  eq?: string;
  dialogMode?: boolean;
  autoLevel?: boolean;
};

const FALLBACK_SITE_KEY = "__default__";

function normalizeHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

function getSiteStorageCandidates(): string[] {
  const candidates = new Set<string>();

  try {
    const normalizedHost = normalizeHostname(window.location.hostname || "");
    if (normalizedHost) {
      candidates.add(normalizedHost);
      const parts = normalizedHost.split(".").filter(Boolean);
      // Fall back from subdomains to parent domain when only parent state exists.
      for (let i = 1; i < parts.length - 1; i += 1) {
        candidates.add(parts.slice(i).join("."));
      }
    }
  } catch (e) {}

  try {
    const origin = window.location.origin;
    if (origin && origin !== "null") {
      candidates.add(`origin:${origin.toLowerCase()}`);
    }
  } catch (e) {}

  candidates.add(FALLBACK_SITE_KEY);
  return Array.from(candidates);
}

function getPrimarySiteStorageKey(): string {
  return getSiteStorageCandidates()[0] || FALLBACK_SITE_KEY;
}

function coerceBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function coerceEq(value: unknown): string | undefined {
  return value === "flat" || value === "bass" ? value : undefined;
}

function coerceVolume(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return undefined;
  return Math.min(6, Math.max(0, value));
}

function coerceSettings(value: unknown): PersistedSettings {
  if (!value || typeof value !== "object") return {};
  const source = value as PersistedSettings;
  const volume = coerceVolume(source.volume);
  const eq = coerceEq(source.eq);
  const dialogMode = coerceBoolean(source.dialogMode);
  const autoLevel = coerceBoolean(source.autoLevel);
  return { volume, eq, dialogMode, autoLevel };
}

function applyStatePatch(patch: PersistedSettings) {
  if (patch.volume !== undefined) currentVolume = patch.volume;
  if (patch.eq !== undefined) currentEq = patch.eq;
  if (patch.dialogMode !== undefined) currentDialogMode = patch.dialogMode;
  if (patch.autoLevel !== undefined) currentAutoLevel = patch.autoLevel;
}

function getSettingsMap(value: unknown): Record<string, PersistedSettings> {
  return value && typeof value === "object" ? (value as Record<string, PersistedSettings>) : {};
}

function getScopedSettings(settings: Record<string, PersistedSettings>): PersistedSettings {
  const candidates = getSiteStorageCandidates();
  for (const key of candidates) {
    const entry = coerceSettings(settings[key]);
    if (
      entry.volume !== undefined ||
      entry.eq !== undefined ||
      entry.dialogMode !== undefined ||
      entry.autoLevel !== undefined
    ) {
      return entry;
    }
  }
  return {};
}

// Save helper for domain-specific settings
async function saveSettings() {
  if (currentMemoryScope === "tab") {
    sessionStorage.setItem("soundfox_tab_state", JSON.stringify({
      volume: currentVolume,
      eq: currentEq,
      dialogMode: currentDialogMode,
      autoLevel: currentAutoLevel
    }));
    return;
  }

  const siteKey = getPrimarySiteStorageKey();
  try {
    const data = await browser.storage.local.get("settings");
    const settings = getSettingsMap(data.settings);
    settings[siteKey] = {
      volume: currentVolume,
      eq: currentEq,
      dialogMode: currentDialogMode,
      autoLevel: currentAutoLevel
    };
    await browser.storage.local.set({ settings });
  } catch (e) {}
}

// Async init variables from storage to ensure state persists across video/episode reloads
try {
  browser.storage.local.get(["settings", "memoryScope", "volume", "eq", "dialogMode", "autoLevel"]).then((data) => {
    currentMemoryScope = data.memoryScope === "tab" ? "tab" : "site";
    
    let scopedSettings: PersistedSettings = {};
    if (currentMemoryScope === "tab") {
      const tabData = sessionStorage.getItem("soundfox_tab_state");
      if (tabData) {
        try { scopedSettings = coerceSettings(JSON.parse(tabData)); } catch(e){}
      }
    } else {
      const settings = getSettingsMap(data.settings);
      scopedSettings = getScopedSettings(settings);

      const legacy = coerceSettings({
        volume: data.volume,
        eq: data.eq,
        dialogMode: data.dialogMode,
        autoLevel: data.autoLevel
      });
      const hasLegacyData =
        legacy.volume !== undefined ||
        legacy.eq !== undefined ||
        legacy.dialogMode !== undefined ||
        legacy.autoLevel !== undefined;
      const hasScopedData =
        scopedSettings.volume !== undefined ||
        scopedSettings.eq !== undefined ||
        scopedSettings.dialogMode !== undefined ||
        scopedSettings.autoLevel !== undefined;

      if (!hasScopedData && hasLegacyData) {
        const siteKey = getPrimarySiteStorageKey();
        settings[siteKey] = legacy;
        scopedSettings = legacy;
        browser.storage.local
          .set({ settings })
          .then(() => browser.storage.local.remove(["volume", "eq", "dialogMode", "autoLevel"]))
          .catch(() => {});
      }
    }

    applyStatePatch(scopedSettings);
    
    if (audioCtx) {
      if (gainNode) gainNode.gain.value = currentVolume;
      if (biquadFilter) biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
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
    const newSettings = getSettingsMap(changes.settings.newValue);
    const oldSettings = getSettingsMap(changes.settings.oldValue);
    
    const hostSettings = getScopedSettings(newSettings);
    const oldHostSettings = getScopedSettings(oldSettings);

    if (hostSettings.volume !== undefined && hostSettings.volume !== oldHostSettings.volume) {
      currentVolume = hostSettings.volume;
      if (gainNode) gainNode.gain.value = currentVolume;
    }
    if (hostSettings.eq !== undefined && hostSettings.eq !== oldHostSettings.eq) {
      currentEq = hostSettings.eq;
      if (biquadFilter) biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
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
  if (!biquadFilter || !compressorNode || !levelerNode || !gainNode) return;
  
  // Decouple everything to reset baseline
  biquadFilter.disconnect();
  compressorNode.disconnect();
  levelerNode.disconnect();

  let lastNode: AudioNode = biquadFilter;
  
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
    biquadFilter = audioCtx.createBiquadFilter();
    compressorNode = audioCtx.createDynamicsCompressor();
    levelerNode = audioCtx.createDynamicsCompressor();
    
    // Lowshelf filter specifically hits lower frequency bands
    biquadFilter.type = "lowshelf";
    biquadFilter.frequency.value = 150; // Boost below 150hz
    biquadFilter.gain.value = 0; // Starts flat

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

    // Default Node Topology (PROTOTYPE BASELINE: Bypasses Compressor Entirely)
    biquadFilter.connect(gainNode);
    gainNode.connect(audioCtx.destination); 
  }
}

function bindMediaElement(el: HTMLMediaElement) {
  if (mediaElements.has(el)) return;
  initAudioContext();
  if (audioCtx && biquadFilter) {
    try {
      const source = audioCtx.createMediaElementSource(el);
      source.connect(biquadFilter);
      mediaElements.add(el);
      
      if (gainNode) gainNode.gain.value = currentVolume;
      if (biquadFilter) biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
      updateGraphRouting();
      
      // Bind seamlessly to SPA episode jumps to explicitly map variables
      el.addEventListener('loadeddata', () => {
        if (gainNode) gainNode.gain.value = currentVolume;
        if (biquadFilter) biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
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
browser.runtime.onMessage.addListener((message: any) => {
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
    currentEq = message.mode;
    saveSettings();
    if (biquadFilter && audioCtx) {
      biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
    }
  } else if (message.action === "setDialogMode") {
    currentDialogMode = message.active;
    if (currentDialogMode) {
      currentEq = "flat";
      if (biquadFilter && audioCtx) biquadFilter.gain.value = 0;
    }
    saveSettings();
    if (compressorNode && biquadFilter && gainNode && audioCtx) {
      updateGraphRouting();
    }
  } else if (message.action === "setAutoLevel") {
    currentAutoLevel = message.active;
    if (currentAutoLevel) {
      currentEq = "flat";
      if (biquadFilter && audioCtx) biquadFilter.gain.value = 0;
    }
    saveSettings();
    if (levelerNode && biquadFilter && gainNode && audioCtx) {
      updateGraphRouting();
    }
  } else if (message.action === "setMemoryScope") {
    currentMemoryScope = message.scope;
    try { browser.storage.local.set({ memoryScope: currentMemoryScope }); } catch(e) {}
    saveSettings();
  } else if (message.action === "getState") {
    return Promise.resolve({
      volume: currentVolume,
      eq: currentEq,
      dialogMode: currentDialogMode,
      autoLevel: currentAutoLevel,
      memoryScope: currentMemoryScope
    });
  }
});
