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

  const hostname = window.location.hostname;
  try {
    const data = await browser.storage.local.get("settings");
    const settings: Record<string, any> = data.settings || {};
    settings[hostname] = {
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
  browser.storage.local.get(["settings", "memoryScope"]).then((data) => {
    currentMemoryScope = (data.memoryScope as "site" | "tab") || "site";
    
    let hostSettings: any = {};
    if (currentMemoryScope === "tab") {
      const tabData = sessionStorage.getItem("soundfox_tab_state");
      if (tabData) {
        try { hostSettings = JSON.parse(tabData); } catch(e){}
      }
    } else {
      const hostname = window.location.hostname;
      const settings: Record<string, any> = data.settings || {};
      hostSettings = settings[hostname] || {};
    }

    if (hostSettings.volume !== undefined) currentVolume = hostSettings.volume as number;
    if (hostSettings.eq !== undefined) currentEq = hostSettings.eq as string;
    if (hostSettings.dialogMode !== undefined) currentDialogMode = hostSettings.dialogMode as boolean;
    if (hostSettings.autoLevel !== undefined) currentAutoLevel = hostSettings.autoLevel as boolean;
    
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
    const hostname = window.location.hostname;
    const newSettings = changes.settings.newValue as Record<string, any>;
    const oldSettings = (changes.settings.oldValue as Record<string, any> | undefined) || {};
    
    const hostSettings = newSettings[hostname];
    const oldHostSettings = oldSettings[hostname] || {};
    
    if (!hostSettings) return;

    if (hostSettings.volume !== undefined && hostSettings.volume !== oldHostSettings.volume) {
      currentVolume = hostSettings.volume as number;
      if (gainNode) gainNode.gain.value = currentVolume;
    }
    if (hostSettings.eq !== undefined && hostSettings.eq !== oldHostSettings.eq) {
      currentEq = hostSettings.eq as string;
      if (biquadFilter) biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
    }
    if (hostSettings.dialogMode !== undefined && hostSettings.dialogMode !== oldHostSettings.dialogMode) {
      currentDialogMode = hostSettings.dialogMode as boolean;
      updateGraphRouting();
    }
    if (hostSettings.autoLevel !== undefined && hostSettings.autoLevel !== oldHostSettings.autoLevel) {
      currentAutoLevel = hostSettings.autoLevel as boolean;
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
