import { isHatchPetState } from "./hatchPetSpec";
import { DEFAULT_ACTIVE_PET, FALLBACK_BUILT_IN_PETS, findBuiltInPet, getBuiltInPets } from "./petCatalog";
import { stripRuntimePetConfig } from "./petRepository";
import type { PetIdentity, PetSettings } from "./types";

export const DEFAULT_SETTINGS: PetSettings = {
  enabled: true,
  petId: DEFAULT_ACTIVE_PET.id,
  activePet: DEFAULT_ACTIVE_PET,
  recentPets: FALLBACK_BUILT_IN_PETS.slice(0, 4),
  scale: 1,
  animationSpeed: 1,
  position: null,
  debugMode: false,
  forcedState: null,
  currentAnimationState: "idle",
  importedPets: [],
  lastUpdatedAt: 0
};

let memorySettings: PetSettings = { ...DEFAULT_SETTINGS };

function normalizeSettings(value: Partial<PetSettings> | undefined, builtInPets = FALLBACK_BUILT_IN_PETS): PetSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(value || {}) };
  const importedPets = normalizeImportedPets(merged.importedPets);
  const activePet = findAvailablePet(merged.activePet?.id || merged.petId, importedPets, builtInPets);
  return {
    enabled: Boolean(merged.enabled),
    petId: activePet.id,
    activePet,
    recentPets: builtInPets.slice(0, 4),
    scale: Math.min(2, Math.max(0.5, Number(merged.scale) || DEFAULT_SETTINGS.scale)),
    animationSpeed: Math.min(2, Math.max(0.25, Number(merged.animationSpeed) || DEFAULT_SETTINGS.animationSpeed)),
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
      config: stripRuntimePetConfig(pet.config!)
    }));
}

function findAvailablePet(petId: string | undefined, importedPets: PetIdentity[], builtInPets = FALLBACK_BUILT_IN_PETS): PetIdentity {
  if (!petId) return DEFAULT_ACTIVE_PET;
  return importedPets.find((pet) => pet.id === petId) || findBuiltInPet(petId, builtInPets);
}

export async function getPetSettings(): Promise<PetSettings> {
  try {
    const builtInPets = await getBuiltInPets();
    const stored = await chrome.storage.local.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
    memorySettings = normalizeSettings(stored as Partial<PetSettings>, builtInPets);
    return memorySettings;
  } catch {
    return memorySettings;
  }
}

export async function savePetSettings(settings: Partial<PetSettings>): Promise<PetSettings> {
  const builtInPets = await getBuiltInPets();
  const next = normalizeSettings({ ...memorySettings, ...settings, lastUpdatedAt: Date.now() }, builtInPets);
  memorySettings = next;
  try {
    await chrome.storage.local.set(next);
  } catch {
    // Storage can be unavailable in tests or restricted contexts; memory fallback keeps the UI responsive.
  }
  return next;
}
