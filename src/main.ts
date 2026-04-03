import './style.css'
import browser from "webextension-polyfill";


document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="glass-panel">
    <div>
      <h1>SoundFox</h1>
      <p class="subtitle">Master Your Browser Audio</p>
    </div>

    <div class="slider-container">
      <div class="slider-label">
        <span>Volume Boost</span>
        <span id="volVal">100%</span>
      </div>
      <input type="range" id="volSlider" min="0" max="300" value="100" />
    </div>

    <div class="toggles">
      <button class="toggle-btn active" id="btnEq">Flat EQ</button>
      <button class="toggle-btn" id="btnBass">Bass Boost</button>
    </div>
  </div>
`

const volSlider = document.getElementById('volSlider') as HTMLInputElement
const volVal = document.getElementById('volVal') as HTMLSpanElement

volSlider.addEventListener('input', async (e) => {
  const val = parseInt((e.target as HTMLInputElement).value)
  volVal.innerText = `${val}%`
  
  const gainValue = val / 100;

  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, {
        action: "setVolume",
        value: gainValue
      });
    }
  } catch (err) {
    console.error("SoundFox Error: Could not send message to tab", err);
  }
})

const btnEq = document.getElementById('btnEq') as HTMLButtonElement
const btnBass = document.getElementById('btnBass') as HTMLButtonElement

btnEq.addEventListener('click', async () => {
  btnEq.classList.add('active')
  btnBass.classList.remove('active')
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, { action: "setEq", mode: "flat" });
    }
  } catch(e) {}
})

btnBass.addEventListener('click', async () => {
  btnBass.classList.add('active')
  btnEq.classList.remove('active')
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, { action: "setEq", mode: "bass" });
    }
  } catch(e) {}
})
