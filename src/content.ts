import browser from "webextension-polyfill";

console.log("SoundFox Content Script attached.");

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let biquadFilter: BiquadFilterNode | null = null;
const mediaElements = new WeakSet<HTMLMediaElement>();

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new window.AudioContext();
    gainNode = audioCtx.createGain();
    biquadFilter = audioCtx.createBiquadFilter();
    
    // Lowshelf filter specifically hits lower frequency bands
    biquadFilter.type = "lowshelf";
    biquadFilter.frequency.value = 150; // Boost below 150hz
    biquadFilter.gain.value = 0; // Starts flat

    biquadFilter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
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
      // Apply linear gain: 1 = standard volume, 2 = 200% volume, etc.
      gainNode.gain.value = message.value;
      console.log(`SoundFox: Volume set to ${message.value * 100}%`);
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
  }
});
