import browser from "webextension-polyfill";

console.log("SoundFox Content Script attached.");

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let biquadFilter: BiquadFilterNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;
let analyser: AnalyserNode | null = null;
const mediaElements = new Set<HTMLMediaElement>();

let currentVolume = 1;
let currentEq = "flat";
let currentNightMode = false;

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new window.AudioContext();
    gainNode = audioCtx.createGain();
    biquadFilter = audioCtx.createBiquadFilter();
    compressorNode = audioCtx.createDynamicsCompressor();
    analyser = audioCtx.createAnalyser();
    
    // Lowshelf filter specifically hits lower frequency bands
    biquadFilter.type = "lowshelf";
    biquadFilter.frequency.value = 150; // Boost below 150hz
    biquadFilter.gain.value = 0; // Starts flat

    // Setup Compressor Settings to be ready when spliced
    compressorNode.threshold.value = -35; 
    compressorNode.knee.value = 20;
    compressorNode.ratio.value = 12; 
    compressorNode.attack.value = 0.005;
    compressorNode.release.value = 0.25;

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
    }
  } else if (message.action === "setNightMode") {
    if (compressorNode && biquadFilter && audioCtx) {
      if (message.active) {
        // Dynamically Splice Compressor into active graph
        biquadFilter.disconnect();
        
        biquadFilter.connect(compressorNode);
        compressorNode.connect(gainNode);
        console.log("SoundFox: Night Mode Compressor Spliced In");
      } else {
        // Return to Standard Bypassed Baseline Prototype
        biquadFilter.disconnect();
        compressorNode.disconnect();
        
        biquadFilter.connect(gainNode);
        console.log("SoundFox: Night Mode Bypassed");
      }
      currentNightMode = message.active;
    }
  } else if (message.action === "getState") {
    return Promise.resolve({
      volume: currentVolume,
      eq: currentEq,
      nightMode: currentNightMode
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
