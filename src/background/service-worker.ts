import { BUILT_IN_PETS, DEFAULT_ACTIVE_PET, findBuiltInPet } from "../pet/petCatalog";
import type { HatchPetState, PetIdentity, PetSettings } from "../pet/types";

const HATCH_PET_STATES: HatchPetState[] = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review"
];

const MESSAGE_TYPES = {
  getGlobalState: "PET_GET_GLOBAL_STATE",
  updateGlobalState: "PET_UPDATE_GLOBAL_STATE",
  globalStateUpdated: "PET_GLOBAL_STATE_UPDATED",
  resetPosition: "PET_RESET_POSITION"
} as const;

const PET_REPOSITORY_KEY = "PET_REPOSITORY";

const DEFAULT_GLOBAL_STATE: PetSettings = {
  enabled: true,
  petId: DEFAULT_ACTIVE_PET.id,
  activePet: DEFAULT_ACTIVE_PET,
  recentPets: BUILT_IN_PETS.slice(0, 4),
  scale: 1,
  animationSpeed: 1,
  position: null,
  debugMode: false,
  forcedState: null,
  currentAnimationState: "idle",
  importedPets: [],
  lastUpdatedAt: 0
};

function isHatchPetState(value: unknown): value is HatchPetState {
  return typeof value === "string" && HATCH_PET_STATES.includes(value as HatchPetState);
}

function normalizeState(value: Partial<PetSettings> | undefined): PetSettings {
  const merged = { ...DEFAULT_GLOBAL_STATE, ...(value || {}) };
  const importedPets = normalizeImportedPets(merged.importedPets);
  const activePet = findAvailablePet(merged.activePet?.id || merged.petId, importedPets);

  return {
    enabled: Boolean(merged.enabled),
    petId: activePet.id,
    activePet,
    recentPets: BUILT_IN_PETS.slice(0, 4),
    scale: Math.min(2, Math.max(0.5, Number(merged.scale) || DEFAULT_GLOBAL_STATE.scale)),
    animationSpeed: Math.min(2, Math.max(0.25, Number(merged.animationSpeed) || DEFAULT_GLOBAL_STATE.animationSpeed)),
    position: merged.position && Number.isFinite(merged.position.x) && Number.isFinite(merged.position.y) ? merged.position : null,
    debugMode: Boolean(merged.debugMode),
    forcedState: isHatchPetState(merged.forcedState) ? merged.forcedState : null,
    currentAnimationState: isHatchPetState(merged.currentAnimationState) ? merged.currentAnimationState : "idle",
    importedPets,
    lastUpdatedAt: Number(merged.lastUpdatedAt) || Date.now()
  };
}

function normalizeImportedPets(value: unknown): PetIdentity[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((pet): pet is PetIdentity => Boolean(pet?.id && pet?.config?.id))
    .map((pet) => ({
      id: pet.id,
      displayName: pet.displayName || pet.config?.displayName || pet.id,
      description: pet.description || pet.config?.description,
      source: "imported" as const,
      config: {
        id: pet.config!.id,
        displayName: pet.config!.displayName,
        description: pet.config!.description,
        spritesheetPath: pet.config!.spritesheetPath || "spritesheet.webp",
        browserPet: pet.config!.browserPet,
        animations: pet.config!.animations
      }
    }))
    .slice(0, 4);
}

function findAvailablePet(petId: string | undefined, importedPets: PetIdentity[]): PetIdentity {
  if (!petId) return DEFAULT_ACTIVE_PET;
  return importedPets.find((pet) => pet.id === petId) || findBuiltInPet(petId);
}

async function readGlobalState(): Promise<PetSettings> {
  const stored = await chrome.storage.local.get(DEFAULT_GLOBAL_STATE as unknown as Record<string, unknown>);
  await migrateLegacyImportedPets(stored as Partial<PetSettings>);
  const state = normalizeState(stored as Partial<PetSettings>);
  await chrome.storage.local.set(state);
  return state;
}

async function writeGlobalState(patch: Partial<PetSettings>): Promise<PetSettings> {
  const current = await readGlobalState();
  const state = normalizeState({ ...current, ...patch, lastUpdatedAt: Date.now() });
  await chrome.storage.local.set(state);
  return state;
}

async function broadcastGlobalState(state: PetSettings): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.globalStateUpdated, settings: state });
      } catch {
        // Restricted pages or tabs without the content script are expected here.
      }
    })
  );
}

chrome.runtime.onInstalled.addListener(() => {
  void readGlobalState();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    if (message?.type === MESSAGE_TYPES.getGlobalState) {
      sendResponse({ settings: await readGlobalState() });
      return;
    }

    if (message?.type === MESSAGE_TYPES.updateGlobalState) {
      const state = await writeGlobalState(message.patch || {});
      await broadcastGlobalState(state);
      sendResponse({ settings: state });
      return;
    }

    if (message?.type === MESSAGE_TYPES.resetPosition) {
      const state = await writeGlobalState({ position: null });
      await broadcastGlobalState(state);
      sendResponse({ settings: state });
    }
  })();

  return true;
});

async function migrateLegacyImportedPets(stored: Partial<PetSettings>): Promise<void> {
  const legacyImportedPets = Array.isArray(stored.importedPets) ? stored.importedPets : [];
  const legacyAssets = legacyImportedPets.filter((pet) => pet.source === "imported" && pet.config?.id && "spritesheetDataUrl" in pet);
  if (legacyAssets.length === 0) return;

  const repositoryStored = await chrome.storage.local.get({ [PET_REPOSITORY_KEY]: { imported: {} } });
  const repository = repositoryStored[PET_REPOSITORY_KEY] as { imported?: Record<string, unknown> };
  const imported = { ...(repository.imported || {}) };

  for (const pet of legacyAssets) {
    const spritesheetDataUrl = (pet as unknown as { spritesheetDataUrl?: string }).spritesheetDataUrl;
    if (!spritesheetDataUrl || !pet.config?.id) continue;
    imported[pet.id] = {
      id: pet.id,
      config: {
        id: pet.config.id,
        displayName: pet.config.displayName,
        description: pet.config.description,
        spritesheetPath: pet.config.spritesheetPath || "spritesheet.webp",
        browserPet: pet.config.browserPet,
        animations: pet.config.animations
      },
      spritesheetDataUrl
    };
  }

  await chrome.storage.local.set({ [PET_REPOSITORY_KEY]: { imported } });
}
