import browser from "webextension-polyfill";

browser.runtime.onInstalled.addListener(() => {
  console.log("SoundFox installed.");
});

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

// Initial hydration upon background/service-worker boot sequence
browser.storage.local.get("volume").then((data) => {
  if (data.volume !== undefined) updateBadge(data.volume as number);
}).catch(() => {});

// Live hydration broadcast from Popup inputs across the DOM
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.volume && changes.volume.newValue !== undefined) {
    updateBadge(changes.volume.newValue as number);
  }
});
