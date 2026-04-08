import './style.css'
import browser from "webextension-polyfill";
import type { PopupToContentMessage, SoundFoxStateV2 } from "./messages";
import type { EqBandsTuple, MemoryScope } from "./settings";

const EQ_BAND_LABELS = ["60Hz", "300Hz", "1k", "3k", "12k"] as const;
const EQ_PRESET_BALANCED: EqBandsTuple = [0, 0, 0, 0, 0];
const EQ_PRESET_BASS: EqBandsTuple = [8, 4, 0, 0, 0];
const EQ_PRESET_DIALOG: EqBandsTuple = [-3, -1, 4, 3, 1];

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="glass-panel">
    <div class="header-row compact">
      <img src="soundfox.png" alt="Icon" class="speaker-icon mini" />
      <h1 class="mini">SoundFox</h1>
      <span class="version">v1.4.0</span>
    </div>


    <div class="slider-container">
      <div class="slider-label">
        <span>Gain Target</span>
        <span id="volVal">100%</span>
      </div>
      <input type="range" id="volSlider" min="0" max="600" value="100" />
      <div class="presets-row">
        <button class="preset-btn" data-val="0" title="Mute (0)">0</button>
        <button class="preset-btn" data-val="50" title="50% Volume (9)">1/2</button>
        <button class="preset-btn" data-val="100" title="100% Volume (1)">1</button>
        <button class="preset-btn" data-val="200" title="200% Volume (2)">2</button>
        <button class="preset-btn" data-val="300" title="300% Volume (3)">3</button>
        <button class="preset-btn" data-val="400" title="400% Volume (4)">4</button>
        <button class="preset-btn" data-val="500" title="500% Volume (5)">5</button>
        <button class="preset-btn" data-val="600" title="600% Volume (6)">6</button>
      </div>
    </div>

    <div class="controls-grid">
      <button class="toggle-btn active compact" id="btnEq" title="Balanced audio profile with no bass boost">Balanced</button>
      <button class="toggle-btn compact" id="btnBass" title="Applies a +15dB filter to amplify tracking bass frequencies">Bass</button>
      <button class="toggle-btn compact dialog-mode" id="btnDialog" title="Voice clarity mode. Can run with Level. Bass is disabled while either mode is active.">Dialog</button>
      <button class="toggle-btn compact auto-level" id="btnLevel" title="Loudness smoothing mode. Can run with Dialog. Bass is disabled while either mode is active.">Level <span class="beta-tag">BETA</span></button>
    </div>

    <details class="eq-panel" id="advancedEqPanel">
      <summary class="eq-summary-row">
        <span>Advanced 5-Band EQ</span>
        <span id="eqSummary">Balanced</span>
      </summary>
      <div class="helper-caption">Use this for headphone/speaker-specific tuning. Balanced/Bass buttons remain the quick everyday modes.</div>
      <div class="eq-sliders">
        ${EQ_BAND_LABELS.map((label, idx) => `
          <div class="eq-band-row">
            <span class="eq-band-label">${label}</span>
            <input class="eq-band-input" type="range" min="-12" max="12" step="1" value="0" data-idx="${idx}" />
            <span class="eq-band-val" id="eqVal${idx}">0dB</span>
          </div>
        `).join("")}
      </div>
      <div class="eq-presets-row">
        <button class="preset-btn eq-preset-btn" data-preset="balanced">Balanced</button>
        <button class="preset-btn eq-preset-btn" data-preset="bass">Bass Boost</button>
        <button class="preset-btn eq-preset-btn" data-preset="dialog">Dialog Focus</button>
        <button class="preset-btn eq-preset-btn" data-preset="reset">Reset</button>
      </div>
    </details>
    <div class="helper-caption">Dialog and Level can run together for combined dynamics control.</div>
    
    <div class="scope-row">
      <span class="memory-label">Memory Engine</span>
      <button class="scope-btn active" id="btnScopeSite" title="Settings apply to all tabs on this website">Site</button>
      <button class="scope-btn" id="btnScopeTab" title="Settings strictly apply to this single tab">Tab</button>
    </div>
  </div>
`

const volSlider = document.getElementById('volSlider') as HTMLInputElement;
const volVal = document.getElementById('volVal') as HTMLSpanElement;
const eqSummary = document.getElementById('eqSummary') as HTMLSpanElement;
const eqBandInputs = Array.from(document.querySelectorAll<HTMLInputElement>('.eq-band-input'));
const eqBandVals = Array.from(document.querySelectorAll<HTMLSpanElement>('.eq-band-val'));
const eqPresetBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.eq-preset-btn'));

const sendVolMessage = async (gainValue: number) => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      if (tabs[0].url) {
        try {
          const hostname = new URL(tabs[0].url).hostname;
          if (hostname) {
            console.log(`Setting volume for ${hostname} to ${gainValue}`);
          }
        } catch (e) {}
      }
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

const applyPresetValue = (val: number) => {
  updateSliderUI(val);
  sendVolMessage(val / 100);
};

const keyPresetMap: Record<string, number> = {
  "0": 0,
  "1": 100,
  "2": 200,
  "3": 300,
  "4": 400,
  "5": 500,
  "6": 600,
  "9": 50
};

volSlider.addEventListener('input', (e) => {
  const val = parseInt((e.target as HTMLInputElement).value);
  applyPresetValue(val);
});

// Configure 0-6 Presets
const presetBtns = document.querySelectorAll('.preset-btn');
presetBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const val = parseInt((e.target as HTMLButtonElement).getAttribute('data-val')!);
    applyPresetValue(val);
  });
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const preset = keyPresetMap[e.key];
  if (preset === undefined) return;
  e.preventDefault();
  applyPresetValue(preset);
});

const btnEq = document.getElementById('btnEq') as HTMLButtonElement;
const btnBass = document.getElementById('btnBass') as HTMLButtonElement;
const btnDialog = document.getElementById('btnDialog') as HTMLButtonElement;
const btnLevel = document.getElementById('btnLevel') as HTMLButtonElement;
const btnScopeSite = document.getElementById('btnScopeSite') as HTMLButtonElement;
const btnScopeTab = document.getElementById('btnScopeTab') as HTMLButtonElement;

let dialogModeActive = false;
let autoLevelActive = false;
let memoryScope: MemoryScope = "site";
let currentEqBands: EqBandsTuple = [...EQ_PRESET_BALANCED];

const sendToActiveTab = async <T = void>(message: PopupToContentMessage): Promise<T | undefined> => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return;
    return await browser.tabs.sendMessage(tabs[0].id, message) as T;
  } catch (e) {
    return;
  }
};

const areBandsEqual = (a: EqBandsTuple, b: readonly number[]) => a.every((v, i) => v === b[i]);

const coerceEqBands = (value: unknown): EqBandsTuple => {
  if (!Array.isArray(value) || value.length !== 5) return [...EQ_PRESET_BALANCED];
  return [
    Number(value[0]) || 0,
    Number(value[1]) || 0,
    Number(value[2]) || 0,
    Number(value[3]) || 0,
    Number(value[4]) || 0
  ];
};

const updateEqUI = (bands: EqBandsTuple) => {
  currentEqBands = [...bands];
  eqBandInputs.forEach((input, idx) => {
    const value = bands[idx] ?? 0;
    input.value = String(value);
    const prefix = value > 0 ? "+" : "";
    if (eqBandVals[idx]) eqBandVals[idx].innerText = `${prefix}${value}dB`;
  });

  if (areBandsEqual(currentEqBands, EQ_PRESET_BALANCED)) {
    eqSummary.innerText = "Balanced";
  } else if (areBandsEqual(currentEqBands, EQ_PRESET_BASS)) {
    eqSummary.innerText = "Bass Boost";
  } else if (areBandsEqual(currentEqBands, EQ_PRESET_DIALOG)) {
    eqSummary.innerText = "Dialog Focus";
  } else {
    eqSummary.innerText = "Custom";
  }
};

const sendEqBandsMessage = async (bands: EqBandsTuple) => {
  await sendToActiveTab({ action: "setEqBands", bands });
  const state = await sendToActiveTab<SoundFoxStateV2>({ action: "getState" });
  if (state) updateDashboard(state);
};

function coerceState(value: unknown): SoundFoxStateV2 | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SoundFoxStateV2>;
  if (typeof raw.volume !== "number") return null;

  return {
    volume: raw.volume,
    eq: raw.eq === "bass" ? "bass" : "flat",
    eqBands: coerceEqBands(raw.eqBands),
    dialogMode: Boolean(raw.dialogMode),
    autoLevel: Boolean(raw.autoLevel),
    memoryScope: raw.memoryScope === "tab" ? "tab" : "site"
  };
}

function updateDashboard(state: SoundFoxStateV2) {
  updateSliderUI(state.volume * 100);
  updateEqUI(state.eqBands);

  const isBassCurve = areBandsEqual(currentEqBands, EQ_PRESET_BASS);
  btnEq.classList.toggle("active", state.eq === "flat" && !isBassCurve);
  btnBass.classList.toggle("active", state.eq === "bass" || isBassCurve);
  btnDialog.classList.toggle("active", state.dialogMode);
  btnLevel.classList.toggle("active", state.autoLevel);
  dialogModeActive = state.dialogMode;
  autoLevelActive = state.autoLevel;
  
  memoryScope = state.memoryScope;
  btnScopeSite.classList.toggle("active", memoryScope === "site");
  btnScopeTab.classList.toggle("active", memoryScope === "tab");
  
  // Exclusivity logic: Override Bass DOM space
  if (state.autoLevel && state.dialogMode) {
    btnBass.innerHTML = `<span class="pulse-indicator"></span><span class="pulse-indicator" style="background-color: var(--dialog); box-shadow: 0 0 8px var(--dialog);"></span> Dynamics Active`;
    btnBass.classList.add("disabled");
  } else if (state.autoLevel) {
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
  await sendToActiveTab({ action: "setEq", mode: "flat" });
  const state = await sendToActiveTab<SoundFoxStateV2>({ action: "getState" });
  if (state) updateDashboard(state);
});

btnBass.addEventListener('click', async () => {
  if (btnBass.classList.contains("disabled")) return;
  await sendToActiveTab({ action: "setEq", mode: "bass" });
  const state = await sendToActiveTab<SoundFoxStateV2>({ action: "getState" });
  if (state) updateDashboard(state);
});

btnDialog.addEventListener('click', async () => {
  dialogModeActive = !dialogModeActive;
  await sendToActiveTab({ action: "setDialogMode", active: dialogModeActive });
  const state = await sendToActiveTab<SoundFoxStateV2>({ action: "getState" });
  if (state) updateDashboard(state);
});

btnLevel.addEventListener('click', async () => {
  autoLevelActive = !autoLevelActive;
  await sendToActiveTab({ action: "setAutoLevel", active: autoLevelActive });
  const state = await sendToActiveTab<SoundFoxStateV2>({ action: "getState" });
  if (state) updateDashboard(state);
});

btnScopeSite.addEventListener('click', async () => {
  if (memoryScope === "site") return;
  await sendToActiveTab({ action: "setMemoryScope", scope: "site" });
  const state = await sendToActiveTab<SoundFoxStateV2>({ action: "getState" });
  if (state) updateDashboard(state);
});

btnScopeTab.addEventListener('click', async () => {
  if (memoryScope === "tab") return;
  await sendToActiveTab({ action: "setMemoryScope", scope: "tab" });
  const state = await sendToActiveTab<SoundFoxStateV2>({ action: "getState" });
  if (state) updateDashboard(state);
});

eqBandInputs.forEach((input, idx) => {
  input.addEventListener("input", () => {
    const next: EqBandsTuple = [...currentEqBands];
    next[idx] = parseInt(input.value, 10);
    updateEqUI(next);
    sendEqBandsMessage(next);
  });
});

eqPresetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const preset = btn.dataset.preset;
    if (preset === "balanced" || preset === "reset") {
      const next: EqBandsTuple = [...EQ_PRESET_BALANCED];
      updateEqUI(next);
      sendEqBandsMessage(next);
      return;
    }

    if (preset === "bass") {
      const next: EqBandsTuple = [...EQ_PRESET_BASS];
      updateEqUI(next);
      sendEqBandsMessage(next);
      return;
    }

    if (preset === "dialog") {
      const next: EqBandsTuple = [...EQ_PRESET_DIALOG];
      updateEqUI(next);
      sendEqBandsMessage(next);
    }
  });
});

// Initial Sync from Active Tab
(async () => {
  try {
    const rawState = await sendToActiveTab<SoundFoxStateV2>({ action: "getState" });
    const state = coerceState(rawState);
    if (state) updateDashboard(state);
  } catch (e) {
    console.warn("SoundFox: Could not sync state with active tab.");
  }
})();
