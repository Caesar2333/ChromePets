import { BrowserPetOverlay } from "./injectPet";
import type { PetSettings, Position } from "../pet/types";

let overlay: BrowserPetOverlay | null = null;

const MESSAGE_TYPES = {
  getGlobalState: "PET_GET_GLOBAL_STATE",
  updateGlobalState: "PET_UPDATE_GLOBAL_STATE",
  globalStateUpdated: "PET_GLOBAL_STATE_UPDATED",
  getStatus: "PET_GET_STATUS",
  statusResponse: "PET_STATUS_RESPONSE"
} as const;

function canInject(): boolean {
  if (window.top !== window.self) return false;
  if (!document.documentElement) return false;

  const url = window.location.href;
  const blockedPrefixes = ["chrome://", "edge://", "about:", "chrome-extension://"];
  if (blockedPrefixes.some((prefix) => url.startsWith(prefix))) return false;
  if (url.startsWith("https://chrome.google.com/webstore") || url.startsWith("https://chromewebstore.google.com/")) return false;
  return true;
}

async function getGlobalState(): Promise<PetSettings | null> {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.getGlobalState });
    return response?.settings ?? null;
  } catch {
    return null;
  }
}

function commitPosition(position: Position | null): void {
  void chrome.runtime.sendMessage({ type: MESSAGE_TYPES.updateGlobalState, patch: { position } });
}

async function ensureOverlay(settings: PetSettings): Promise<BrowserPetOverlay | null> {
  if (!canInject()) return null;
  if (!settings.enabled) return null;
  if (overlay) return overlay;
  if (document.getElementById("browser-pet-root")) return null;

  overlay = new BrowserPetOverlay({ onPositionCommit: commitPosition });
  try {
    await overlay.mount(settings);
  } catch (error) {
    console.warn("[Codex Browser Pet] Overlay injection skipped", error);
    overlay?.destroy();
    overlay = null;
  }
  return overlay;
}

void (async () => {
  const state = await getGlobalState();
  if (state) await ensureOverlay(state);
})();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    if (message.type === MESSAGE_TYPES.globalStateUpdated) {
      const settings = message.settings as PetSettings;
      if (!settings.enabled) {
        overlay?.destroy();
        overlay = null;
        return;
      }
      if (!overlay) {
        await ensureOverlay(settings);
      } else {
        await overlay.applySettings(settings);
      }
      return;
    }

    if (message.type === MESSAGE_TYPES.getStatus) {
      sendResponse({ type: MESSAGE_TYPES.statusResponse, status: overlay?.getStatus() ?? null });
    }
  })();

  return message.type === MESSAGE_TYPES.getStatus;
});
