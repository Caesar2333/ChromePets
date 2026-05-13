import { isHatchPetState } from "./hatchPetSpec";
import { BUILT_IN_PETS, DEFAULT_ACTIVE_PET, findBuiltInPet } from "./petCatalog";
import { stripRuntimePetConfig } from "./petRepository";
import type { PetIdentity, PetSettings } from "./types";

export const DEFAULT_SETTINGS: PetSettings = {
  enabled: true,
  petId: "wasteland-helper",
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

let memorySettings: PetSettings = { ...DEFAULT_SETTINGS };

function normalizeSettings(value: Partial<PetSettings> | undefined): PetSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(value || {}) };
  const importedPets = normalizeImportedPets(merged.importedPets);
  const activePet = findAvailablePet(merged.activePet?.id || merged.petId, importedPets);
  return {
    enabled: Boolean(merged.enabled),
    petId: activePet.id,
    activePet,
    recentPets: BUILT_IN_PETS.slice(0, 4),
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
    }))
    .slice(0, 4);
}

function findAvailablePet(petId: string | undefined, importedPets: PetIdentity[]): PetIdentity {
  if (!petId) return DEFAULT_ACTIVE_PET;
  return importedPets.find((pet) => pet.id === petId) || findBuiltInPet(petId);
}

export async function getPetSettings(): Promise<PetSettings> {
  try {
    const stored = await chrome.storage.local.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
    memorySettings = normalizeSettings(stored as Partial<PetSettings>);
    return memorySettings;
  } catch {
    return memorySettings;
  }
}

export async function savePetSettings(settings: Partial<PetSettings>): Promise<PetSettings> {
  const next = normalizeSettings({ ...memorySettings, ...settings, lastUpdatedAt: Date.now() });
  memorySettings = next;
  try {
    await chrome.storage.local.set(next);
  } catch {
    // Storage can be unavailable in tests or restricted contexts; memory fallback keeps the UI responsive.
  }
  return next;
}
