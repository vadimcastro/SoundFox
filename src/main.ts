import './style.css'
import browser from "webextension-polyfill";

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="glass-panel">
    <div class="header-row compact">
      <img src="speaker.svg" alt="Icon" class="speaker-icon mini" />
      <h1 class="mini">SoundFox</h1>
      <span class="version">v1.1</span>
    </div>

    <div class="meter-container">
      <div class="meter-label">
        <span>Master Output</span>
        <span id="dbValue">-∞ dBFS</span>
      </div>
      <div class="meter-bar-bg">
        <div class="meter-bar-fill" id="dbBar"></div>
      </div>
    </div>

    <div class="slider-container">
      <div class="slider-label">
        <span>Gain Target</span>
        <span id="volVal">100%</span>
      </div>
      <input type="range" id="volSlider" min="0" max="600" value="100" />
      <div class="presets-row">
        <button class="preset-btn" data-val="0">0</button>
        <button class="preset-btn" data-val="100">1</button>
        <button class="preset-btn" data-val="200">2</button>
        <button class="preset-btn" data-val="300">3</button>
        <button class="preset-btn" data-val="400">4</button>
        <button class="preset-btn" data-val="500">5</button>
        <button class="preset-btn" data-val="600">6</button>
      </div>
    </div>

    <div class="controls-grid">
      <button class="toggle-btn active compact" id="btnEq">Flat</button>
      <button class="toggle-btn compact" id="btnBass">Bass</button>
      <button class="toggle-btn compact night-mode" id="btnNight" title="Compression to equal out loud bangs and quiet whispers">Night</button>
    </div>
  </div>
`

const volSlider = document.getElementById('volSlider') as HTMLInputElement;
const volVal = document.getElementById('volVal') as HTMLSpanElement;
const dbValue = document.getElementById('dbValue') as HTMLSpanElement;
const dbBar = document.getElementById('dbBar') as HTMLDivElement;

const sendVolMessage = async (gainValue: number) => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, {
        action: "setVolume",
        value: gainValue
      });
    }
  } catch (err) {
    console.error("SoundFox Error:", err);
  }
};

const updateSliderUI = (val: number) => {
  volSlider.value = val.toString();
  volVal.innerText = val === 0 ? "MUTED" : `${val}%`;
  if (val === 0) {
    volVal.style.color = '#ef4444';
  } else {
    volVal.style.color = 'inherit';
  }
}

volSlider.addEventListener('input', (e) => {
  const val = parseInt((e.target as HTMLInputElement).value);
  updateSliderUI(val);
  sendVolMessage(val / 100);
});

// Configure 0-6 Presets & Keyboard listeners
const presetBtns = document.querySelectorAll('.preset-btn');
presetBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const val = parseInt((e.target as HTMLButtonElement).getAttribute('data-val')!);
    updateSliderUI(val);
    sendVolMessage(val / 100);
  });
});

document.addEventListener('keydown', (e) => {
  const key = parseInt(e.key);
  if (key >= 0 && key <= 6) {
    const val = key * 100;
    updateSliderUI(val);
    sendVolMessage(val / 100);
  }
});

const btnEq = document.getElementById('btnEq') as HTMLButtonElement;
const btnBass = document.getElementById('btnBass') as HTMLButtonElement;
const btnNight = document.getElementById('btnNight') as HTMLButtonElement;

btnEq.addEventListener('click', async () => {
  btnEq.classList.add('active');
  btnBass.classList.remove('active');
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) await browser.tabs.sendMessage(tabs[0].id, { action: "setEq", mode: "flat" });
  } catch(e) {}
});

btnBass.addEventListener('click', async () => {
  btnBass.classList.add('active');
  btnEq.classList.remove('active');
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) await browser.tabs.sendMessage(tabs[0].id, { action: "setEq", mode: "bass" });
  } catch(e) {}
});

let nightModeActive = false;
btnNight.addEventListener('click', async () => {
  nightModeActive = !nightModeActive;
  if (nightModeActive) btnNight.classList.add('active');
  else btnNight.classList.remove('active');
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) await browser.tabs.sendMessage(tabs[0].id, { action: "setNightMode", active: nightModeActive });
  } catch(e) {}
});

// Polling interval for dB Meter
setInterval(async () => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      browser.tabs.sendMessage(tabs[0].id, { action: "requestDb" }).then((res: any) => {
        if (res && res.db !== undefined) {
          const db = res.db;
          dbValue.innerText = `${db.toFixed(1)} dBFS`;
          
          // Map -60dB (silence) to 0dB (peak)
          let width = ((db + 60) / 60) * 100;
          width = Math.max(0, Math.min(100, width));
          dbBar.style.width = `${width}%`;
          
          if (db > -3) { // Red zone close to digital peak 0 clipping
            dbBar.style.background = '#ef4444'; 
          } else if (db > -12) { // Yellow warning zone
            dbBar.style.background = '#f59e0b'; 
          } else {
            dbBar.style.background = 'var(--primary)';
          }
        }
      }).catch(() => {});
    }
  } catch(e) {}
}, 50);
