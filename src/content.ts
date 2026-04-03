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
browser.storage.local.get(["volume", "eq", "dialogMode", "autoLevel"]).then((data) => {
  if (data.volume !== undefined) currentVolume = data.volume;
  if (data.eq !== undefined) currentEq = data.eq;
  if (data.dialogMode !== undefined) currentDialogMode = data.dialogMode;
  if (data.autoLevel !== undefined) currentAutoLevel = data.autoLevel;
  
  if (audioCtx) {
    if (gainNode) gainNode.gain.value = currentVolume;
    if (biquadFilter) biquadFilter.gain.value = currentEq === "bass" ? 15 : 0;
    updateGraphRouting();
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

function attachToMediaElements() {
  const elements = document.querySelectorAll<HTMLMediaElement>("video, audio");
  elements.forEach((el) => {
    if (!mediaElements.has(el)) {
      initAudioContext();
      if (audioCtx && gainNode && biquadFilter) {
        try {
          const source = audioCtx.createMediaElementSource(el);
          source.connect(biquadFilter);
          mediaElements.add(el);
          console.log("SoundFox: Attached to media element", el);
        } catch (e) {
          // If the element is already bound to another context, it might throw here
          console.error("SoundFox: Failed to attach AudioContext", e);
        }
      }
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

// Listen for messages from the Popup
browser.runtime.onMessage.addListener((message: any) => {
  // Automatically force resume on user interaction to bypass modern Auto-Play audio suspension policies
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  if (message.action === "setVolume") {
    if (gainNode && audioCtx) {
      if (message.value === 0) {
        mediaElements.forEach(el => el.muted = true);
        gainNode.gain.value = 0;
        console.log("SoundFox: Fully Muted Output");
      } else {
        mediaElements.forEach(el => el.muted = false);
        // Direct assignment immediately propagates state regardless of isolated Extension clock desyncs
        gainNode.gain.value = message.value;
        console.log(`SoundFox: Volume set to ${message.value * 100}%`);
      }
      currentVolume = message.value;
      browser.storage.local.set({ volume: currentVolume });
    } else {
      console.warn("SoundFox: Cannot set volume, no media element initialized yet.");
    }
  } else if (message.action === "setEq") {
    if (biquadFilter && audioCtx) {
      if (message.mode === "bass") {
        biquadFilter.gain.value = 15; // +15dB of Bass
        console.log("SoundFox: Bass Boost enabled");
      } else {
        biquadFilter.gain.value = 0; // Flat
        console.log("SoundFox: Flat EQ enabled");
      }
      currentEq = message.mode;
      browser.storage.local.set({ eq: currentEq });
    }
  } else if (message.action === "setDialogMode") {
    if (compressorNode && biquadFilter && gainNode && audioCtx) {
      currentDialogMode = message.active;
      browser.storage.local.set({ dialogMode: currentDialogMode });
      updateGraphRouting();
      console.log(`SoundFox: Dialog Mode ${currentDialogMode ? 'Spliced In' : 'Bypassed'}`);
    }
  } else if (message.action === "setAutoLevel") {
    if (levelerNode && biquadFilter && gainNode && audioCtx) {
      currentAutoLevel = message.active;
      browser.storage.local.set({ autoLevel: currentAutoLevel });
      updateGraphRouting();
      console.log(`SoundFox: Auto-Level Mode ${currentAutoLevel ? 'Spliced In' : 'Bypassed'}`);
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
