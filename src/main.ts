import './style.css'
import browser from "webextension-polyfill";

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="glass-panel">
    <div class="header-row compact">
      <img src="speaker.svg" alt="Icon" class="speaker-icon mini" />
      <h1 class="mini">SoundFox</h1>
      <span class="version">v1.2.0</span>
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
        <button class="preset-btn" data-val="0" title="Mute [Shortcut: 0]">0</button>
        <button class="preset-btn" data-val="50" title="50% Volume [Shortcut: 9]">1/2</button>
        <button class="preset-btn" data-val="100" title="100% Volume [Shortcut: 1]">1</button>
        <button class="preset-btn" data-val="200" title="200% Volume [Shortcut: 2]">2</button>
        <button class="preset-btn" data-val="300" title="300% Volume [Shortcut: 3]">3</button>
        <button class="preset-btn" data-val="400" title="400% Volume [Shortcut: 4]">4</button>
        <button class="preset-btn" data-val="500" title="500% Volume [Shortcut: 5]">5</button>
        <button class="preset-btn" data-val="600" title="600% Volume [Shortcut: 6]">6</button>
      </div>
    </div>

    <div class="controls-grid">
      <button class="toggle-btn active compact" id="btnEq" title="Standard uncolored audio output">Flat</button>
      <button class="toggle-btn compact" id="btnBass" title="Applies a +15dB filter to amplify tracking bass frequencies">Bass</button>
      <button class="toggle-btn compact dialog-mode" id="btnDialog" title="Squashes loud peaks and bumps up quiet voices in intense media">Dialog</button>
      <button class="toggle-btn compact auto-level" id="btnLevel" title="Smoothly rides the volume fader across different episodes to prevent massive drops or jumps in overall scene volume">Level <span class="beta-tag">BETA</span></button>
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
  } else if (e.key === '9') {
    updateSliderUI(50);
    sendVolMessage(0.5);
  }
});

const btnEq = document.getElementById('btnEq') as HTMLButtonElement;
const btnBass = document.getElementById('btnBass') as HTMLButtonElement;
const btnDialog = document.getElementById('btnDialog') as HTMLButtonElement;
const btnLevel = document.getElementById('btnLevel') as HTMLButtonElement;

let dialogModeActive = false;
let autoLevelActive = false;

function updateDashboard(state: any) {
  updateSliderUI(state.volume * 100);

  btnEq.classList.toggle("active", state.eq === "flat");
  btnBass.classList.toggle("active", state.eq === "bass");
  btnDialog.classList.toggle("active", state.dialogMode);
  btnLevel.classList.toggle("active", state.autoLevel);
  dialogModeActive = state.dialogMode;
  autoLevelActive = state.autoLevel;
  
  // Exclusivity logic: Override Bass DOM space
  if (state.autoLevel) {
    btnBass.innerHTML = `<span class="pulse-indicator"></span> Active AGC`;
    btnBass.classList.add("disabled");
  } else if (state.dialogMode) {
    btnBass.innerHTML = `<span class="pulse-indicator" style="background-color: var(--dialog); box-shadow: 0 0 8px var(--dialog);"></span> Dialog Lock`;
    btnBass.classList.add("disabled");
  } else {
    btnBass.innerHTML = `Bass`;
    btnBass.classList.remove("disabled");
  }
}

btnEq.addEventListener('click', async () => {
  if (btnDialog.classList.contains("active") || btnLevel.classList.contains("active")) return;
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, { action: "setEq", mode: "flat" });
      const state: any = await browser.tabs.sendMessage(tabs[0].id, { action: "getState" });
      if (state) updateDashboard(state);
    }
  } catch(e) {}
});

btnBass.addEventListener('click', async () => {
  if (btnBass.classList.contains("disabled")) return;
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, { action: "setEq", mode: "bass" });
      const state: any = await browser.tabs.sendMessage(tabs[0].id, { action: "getState" });
      if (state) updateDashboard(state);
    }
  } catch(e) {}
});

btnDialog.addEventListener('click', async () => {
  dialogModeActive = !dialogModeActive;
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, { action: "setDialogMode", active: dialogModeActive });
      const state: any = await browser.tabs.sendMessage(tabs[0].id, { action: "getState" });
      if (state) updateDashboard(state);
    }
  } catch(e) {}
});

btnLevel.addEventListener('click', async () => {
  autoLevelActive = !autoLevelActive;
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, { action: "setAutoLevel", active: autoLevelActive });
      const state: any = await browser.tabs.sendMessage(tabs[0].id, { action: "getState" });
      if (state) updateDashboard(state);
    }
  } catch(e) {}
});

// Initial Sync from Active Tab
(async () => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      const state: any = await browser.tabs.sendMessage(tabs[0].id, { action: "getState" });
      if (state) updateDashboard(state);
    }
  } catch (e) {
    console.warn("SoundFox: Could not sync state with active tab.");
  }
})();

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
