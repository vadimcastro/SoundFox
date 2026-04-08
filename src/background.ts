import browser from "webextension-polyfill";

browser.runtime.onInstalled.addListener(() => {
  console.log("SoundFox installed.");
});

const commandVolumeMap: Record<string, number> = {
  "preset-0": 0,
  "preset-50": 0.5,
  "preset-100": 1,
  "preset-200": 2,
  "preset-300": 3,
  "preset-400": 4,
  "preset-500": 5,
  "preset-600": 6
};

function updateBadge(volume: number) {
  // Gracefully handle MV2 vs MV3 browser implementations natively
  const actionAPI = browser.action || browser.browserAction;
  if (!actionAPI) return;
  
  if (volume === 0) {
    actionAPI.setBadgeText({ text: "OFF" }).catch(() => {});
    actionAPI.setBadgeBackgroundColor({ color: "#ef4444" }).catch(() => {});
  } else {
    const percent = Math.round(volume * 100);
    actionAPI.setBadgeText({ text: `${percent}` }).catch(() => {});
    if (volume > 1) {
      actionAPI.setBadgeBackgroundColor({ color: "#10b981" }).catch(() => {}); // Emerald Green = Boosted
    } else {
      actionAPI.setBadgeBackgroundColor({ color: "#3b82f6" }).catch(() => {}); // Blue = Standard
    }
  }
}

async function setActiveTabVolume(volume: number) {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab?.id) return;

    await browser.tabs.sendMessage(activeTab.id, {
      action: "setVolume",
      value: volume
    });
    updateBadge(volume);
  } catch (e) {}
}

async function updateBadgeForTab(tabId: number) {
  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab.url) return;
    
    const state: any = await browser.tabs.sendMessage(tabId, { action: "getState" });
    if (state && state.volume !== undefined) {
      updateBadge(state.volume as number);
    }
  } catch(e) {}
}

// Initial hydration upon background/service-worker boot sequence
browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs[0] && tabs[0].id) {
    updateBadgeForTab(tabs[0].id);
  }
}).catch(() => {});

browser.tabs.onActivated.addListener(({ tabId }) => {
  updateBadgeForTab(tabId);
});

browser.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  if (tab.active && tab.url) {
    updateBadgeForTab(tabId);
  }
});

browser.commands.onCommand.addListener((command) => {
  const volume = commandVolumeMap[command];
  if (volume === undefined) return;
  setActiveTabVolume(volume);
});

// Live hydration broadcast from Popup inputs across the DOM
browser.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local" && changes.settings) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].id) {
        updateBadgeForTab(tabs[0].id);
      }
    } catch(e) {}
  }
});
