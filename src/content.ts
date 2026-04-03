import browser from "webextension-polyfill";

console.log("SoundFox Content Script attached.");

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let biquadFilter: BiquadFilterNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;
let levelerNode: DynamicsCompressorNode | null = null;
let analyser: AnalyserNode | null = null;
const mediaElements = new Set<HTMLMediaElement>();

let currentVolume = 1;
let currentEq = "flat";
let currentDialogMode = false;
let currentAutoLevel = false;

// Async init variables from storage to ensure state persists across video/episode reloads
try {
  browser.storage.local.get(["volume", "eq", "dialogMode", "autoLevel"]).then((data) => {
    if (data.volume !== undefined) currentVolume = data.volume as number;
    if (data.eq !== undefined) currentEq = data.eq as string;
    if (data.dialogMode !== undefined) currentDialogMode = data.dialogMode as boolean;
    if (data.autoLevel !== undefined) currentAutoLevel = data.autoLevel as boolean;
    
    if (audioCtx) {
      if (gainNode) gainNode.gain.value = currentVolume;
      if (biquadFilter) biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
      updateGraphRouting();
    }
  }).catch(() => {});
} catch (e) {}

// Multi-DOM Synchronizer: Pipes updates from root frame to embedded <iframe> video containers
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.volume && changes.volume.newValue !== undefined) {
      currentVolume = changes.volume.newValue as number;
      if (gainNode) gainNode.gain.value = currentVolume;
    }
    if (changes.eq && changes.eq.newValue !== undefined) {
      currentEq = changes.eq.newValue as string;
      if (biquadFilter) biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
    }
    if (changes.dialogMode && changes.dialogMode.newValue !== undefined) {
      currentDialogMode = changes.dialogMode.newValue as boolean;
      updateGraphRouting();
    }
    if (changes.autoLevel && changes.autoLevel.newValue !== undefined) {
      currentAutoLevel = changes.autoLevel.newValue as boolean;
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
    analyser = audioCtx.createAnalyser();
    
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
    levelerNode.attack.value = 0.5;
    levelerNode.release.value = 1.0;

    // Metric Analyser Setup
    analyser.fftSize = 2048; // Better RMS resolution
    analyser.smoothingTimeConstant = 0.5;

    // Default Node Topology (PROTOTYPE BASELINE: Bypasses Compressor Entirely)
    biquadFilter.connect(gainNode);
    gainNode.connect(analyser); 
    analyser.connect(audioCtx.destination);
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
      updateGraphRouting();
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
    try { browser.storage.local.set({ volume: currentVolume }); } catch(e) {}
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
    try { browser.storage.local.set({ eq: currentEq }); } catch(e) {}
    if (biquadFilter && audioCtx) {
      biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
    }
  } else if (message.action === "setDialogMode") {
    currentDialogMode = message.active;
    if (currentDialogMode) {
      currentAutoLevel = false;
      currentEq = "flat";
      if (biquadFilter && audioCtx) biquadFilter.gain.value = 0;
      try { browser.storage.local.set({ eq: currentEq, autoLevel: currentAutoLevel }); } catch(e) {}
    }
    try { browser.storage.local.set({ dialogMode: currentDialogMode }); } catch(e) {}
    if (compressorNode && biquadFilter && gainNode && audioCtx) {
      updateGraphRouting();
    }
  } else if (message.action === "setAutoLevel") {
    currentAutoLevel = message.active;
    if (currentAutoLevel) {
      currentDialogMode = false;
      currentEq = "flat";
      if (biquadFilter && audioCtx) biquadFilter.gain.value = 0;
      try { browser.storage.local.set({ eq: currentEq, dialogMode: currentDialogMode }); } catch(e) {}
    }
    try { browser.storage.local.set({ autoLevel: currentAutoLevel }); } catch(e) {}
    if (levelerNode && biquadFilter && gainNode && audioCtx) {
      updateGraphRouting();
    }
  } else if (message.action === "getState") {
    return Promise.resolve({
      volume: currentVolume,
      eq: currentEq,
      dialogMode: currentDialogMode,
      autoLevel: currentAutoLevel
    });
  } else if (message.action === "requestDb") {
    let db = -100;
    if (analyser) {
        const floatData = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(floatData);
        let sumSquared = 0;
        for (let i = 0; i < floatData.length; i++) {
          sumSquared += floatData[i] * floatData[i];
        }
        const rms = Math.sqrt(sumSquared / floatData.length);
        if (rms > 0) {
          db = 20 * Math.log10(rms);
        }
    }
    // Content script listeners can return a Promise in MV3 via webextension-polyfill natively
    return Promise.resolve({ db });
  }
});
