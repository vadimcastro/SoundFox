import browser from "webextension-polyfill";

console.log("SoundFox Content Script attached.");

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let biquadFilter: BiquadFilterNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;
let analyser: AnalyserNode | null = null;
const mediaElements = new Set<HTMLMediaElement>();

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

    // Default Compressor Settings (Passthrough)
    compressorNode.threshold.value = 0;
    compressorNode.ratio.value = 1;

    // Metric Analyser Setup
    analyser.fftSize = 2048; // Better RMS resolution
    analyser.smoothingTimeConstant = 0.5;

    biquadFilter.connect(compressorNode);
    compressorNode.connect(gainNode);
    gainNode.connect(analyser); // Chain analyser after gain to read actual output volume
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
  if (message.action === "setVolume") {
    if (gainNode) {
      if (message.value === 0) {
        mediaElements.forEach(el => el.muted = true);
        gainNode.gain.value = 0;
        console.log("SoundFox: Fully Muted Output");
      } else {
        mediaElements.forEach(el => el.muted = false);
        gainNode.gain.value = message.value;
        console.log(`SoundFox: Volume set to ${message.value * 100}%`);
      }
    } else {
      console.warn("SoundFox: Cannot set volume, no media element initialized yet.");
    }
  } else if (message.action === "setEq") {
    if (biquadFilter) {
      if (message.mode === "bass") {
        biquadFilter.gain.value = 15; // +15dB of Bass
        console.log("SoundFox: Bass Boost enabled");
      } else {
        biquadFilter.gain.value = 0; // Flat
        console.log("SoundFox: Flat EQ enabled");
      }
    }
  } else if (message.action === "setNightMode") {
    if (compressorNode) {
      if (message.active) {
        compressorNode.threshold.value = -30; // Squash loud sounds
        compressorNode.ratio.value = 12; // High compression ratio for gunshots
        compressorNode.knee.value = 10;
        compressorNode.attack.value = 0.003; // Attack fast
        compressorNode.release.value = 0.25;
        console.log("SoundFox: Night Mode enabled");
      } else {
        compressorNode.threshold.value = 0; // Passthrough
        compressorNode.ratio.value = 1;
        console.log("SoundFox: Night Mode disabled");
      }
    }
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
