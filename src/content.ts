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

    // Default Master Brickwall Limiter (Prevents Hardware Distortion when Gain hits 600%)
    compressorNode.threshold.value = -1; // Clamp right before 0dBFS
    compressorNode.knee.value = 0;
    compressorNode.ratio.value = 20; // Hard limiting ratio
    compressorNode.attack.value = 0.002;
    compressorNode.release.value = 0.05;

    // Metric Analyser Setup
    analyser.fftSize = 2048; // Better RMS resolution
    analyser.smoothingTimeConstant = 0.5;

    // Secure node topology: EQ -> Gain Drive -> Limiter (prevent peaking) -> Analyser -> Dest
    biquadFilter.connect(gainNode);
    gainNode.connect(compressorNode);
    compressorNode.connect(analyser); 
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
        // Use setTargetAtTime to prevent audio pop/clicking during aggressive adjustments
        gainNode.gain.setTargetAtTime(message.value, audioCtx.currentTime, 0.05);
        console.log(`SoundFox: Volume set to ${message.value * 100}%`);
      }
    } else {
      console.warn("SoundFox: Cannot set volume, no media element initialized yet.");
    }
  } else if (message.action === "setEq") {
    if (biquadFilter && audioCtx) {
      if (message.mode === "bass") {
        biquadFilter.gain.setTargetAtTime(15, audioCtx.currentTime, 0.1); // +15dB of Bass
        console.log("SoundFox: Bass Boost enabled");
      } else {
        biquadFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1); // Flat
        console.log("SoundFox: Flat EQ enabled");
      }
    }
  } else if (message.action === "setNightMode") {
    if (compressorNode && audioCtx) {
      if (message.active) {
        // Night Mode: Aggressively compress dynamic range for normalized viewing
        compressorNode.threshold.setTargetAtTime(-45, audioCtx.currentTime, 0.1);
        compressorNode.knee.setTargetAtTime(30, audioCtx.currentTime, 0.1);
        compressorNode.ratio.setTargetAtTime(15, audioCtx.currentTime, 0.1);
        compressorNode.attack.setTargetAtTime(0.005, audioCtx.currentTime, 0.1);
        compressorNode.release.setTargetAtTime(0.25, audioCtx.currentTime, 0.1);
        console.log("SoundFox: Night Mode enabled");
      } else {
        // Return to Standard Limiter Mode
        compressorNode.threshold.setTargetAtTime(-1, audioCtx.currentTime, 0.1);
        compressorNode.knee.setTargetAtTime(0, audioCtx.currentTime, 0.1);
        compressorNode.ratio.setTargetAtTime(20, audioCtx.currentTime, 0.1);
        compressorNode.attack.setTargetAtTime(0.002, audioCtx.currentTime, 0.1);
        compressorNode.release.setTargetAtTime(0.05, audioCtx.currentTime, 0.1);
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
