import { useEffect, useState } from "react";
import { FALLBACK_BUILT_IN_PETS, findBuiltInPet, getBuiltInPets } from "../pet/petCatalog";
import { stripRuntimePetConfig } from "../pet/petRepository";
import type { PetIdentity, PetSettings } from "../pet/types";

const DEFAULT_ACTIVE_PET = FALLBACK_BUILT_IN_PETS[0];

const DEFAULT_SETTINGS: PetSettings = {
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

const MESSAGE_TYPES = {
  getGlobalState: "PET_GET_GLOBAL_STATE",
  updateGlobalState: "PET_UPDATE_GLOBAL_STATE",
  resetPosition: "PET_RESET_POSITION"
} as const;

function findAvailablePet(petId: string, importedPets: PetIdentity[], builtInPets: PetIdentity[]): PetIdentity {
  return importedPets.find((pet) => pet.id === petId) || findBuiltInPet(petId, builtInPets);
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

function normalizeState(value: Partial<PetSettings> | undefined, builtInPets = FALLBACK_BUILT_IN_PETS): PetSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(value || {}) };
  const importedPets = normalizeImportedPets(merged.importedPets);
  const activePet = merged.activePet?.id ? findAvailablePet(merged.activePet.id, importedPets, builtInPets) : findAvailablePet(merged.petId, importedPets, builtInPets);

  return {
    enabled: Boolean(merged.enabled),
    petId: activePet.id,
    activePet,
    recentPets: builtInPets.slice(0, 4),
    scale: Math.min(2, Math.max(0.5, Number(merged.scale) || DEFAULT_SETTINGS.scale)),
    animationSpeed: Math.min(2, Math.max(0.25, Number(merged.animationSpeed) || DEFAULT_SETTINGS.animationSpeed)),
    position: merged.position && Number.isFinite(merged.position.x) && Number.isFinite(merged.position.y) ? merged.position : null,
    debugMode: Boolean(merged.debugMode),
    forcedState: null,
    currentAnimationState: "idle",
    importedPets,
    lastUpdatedAt: Number(merged.lastUpdatedAt) || Date.now()
  };
}

async function getGlobalState(): Promise<PetSettings> {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.getGlobalState });
  return normalizeState(response?.settings);
}

async function updateGlobalState(patch: Partial<PetSettings>, builtInPets = FALLBACK_BUILT_IN_PETS): Promise<PetSettings> {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.updateGlobalState, patch });
  return normalizeState(response?.settings, builtInPets);
}

async function resetGlobalPosition(): Promise<PetSettings> {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.resetPosition });
  return normalizeState(response?.settings);
}

export function ControlPanel() {
  const [builtInPets, setBuiltInPets] = useState<PetIdentity[]>(FALLBACK_BUILT_IN_PETS);
  const [settings, setSettings] = useState<PetSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void Promise.all([getBuiltInPets(), getGlobalState()]).then(([nextBuiltInPets, nextSettings]) => {
      setBuiltInPets(nextBuiltInPets);
      setSettings(normalizeState(nextSettings, nextBuiltInPets));
    });
  }, []);

  async function patchState(patch: Partial<PetSettings>): Promise<void> {
    setSettings(await updateGlobalState(patch, builtInPets));
  }

  async function selectPet(pet: PetIdentity): Promise<void> {
    await patchState({
      activePet: pet,
      petId: pet.id,
      currentAnimationState: "idle"
    });
  }

  async function openImportPage(): Promise<void> {
    await chrome.tabs.create({ url: chrome.runtime.getURL("import.html") });
    window.close();
  }

  async function openPlayerPage(): Promise<void> {
    await chrome.tabs.create({ url: chrome.runtime.getURL("player.html") });
    window.close();
  }

  return (
    <main className="popup">
      <header className="header">
        <div>
          <h1>Pet Control</h1>
          <p>{settings.activePet.displayName}</p>
        </div>
        <label className="switch" title={settings.enabled ? "Disable Pet" : "Enable Pet"}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => void patchState({ enabled: event.currentTarget.checked })}
          />
          <span />
        </label>
      </header>

      <section className="field">
        <div className="field-row">
          <label htmlFor="scale">Scale</label>
          <span>{settings.scale.toFixed(1)}x</span>
        </div>
        <input
          id="scale"
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={settings.scale}
          onChange={(event) => void patchState({ scale: Number(event.currentTarget.value) })}
        />
      </section>

      <section className="field">
        <div className="field-row">
          <label htmlFor="animation-speed">Animation Speed</label>
          <span>{settings.animationSpeed.toFixed(2)}x</span>
        </div>
        <input
          id="animation-speed"
          type="range"
          min="0.25"
          max="2"
          step="0.05"
          value={settings.animationSpeed}
          onChange={(event) => void patchState({ animationSpeed: Number(event.currentTarget.value) })}
        />
      </section>

      <section className="field">
        <div className="field-row">
          <label>Built-in Pets</label>
          <span>fixed</span>
        </div>
        <div className="pet-grid">
          {builtInPets.map((pet) => (
            <button
              type="button"
              key={pet.id}
              className={pet.id === settings.activePet.id ? "pet-button active" : "pet-button"}
              onClick={() => void selectPet(pet)}
            >
              {pet.displayName}
            </button>
          ))}
          <button type="button" className="pet-button more" onClick={() => void openImportPage()}>
            More
          </button>
        </div>
      </section>

      {settings.importedPets.length > 0 && (
        <section className="field more-panel">
          <div className="field-row">
            <label>Imported Pets</label>
            <span>{settings.importedPets.length}</span>
          </div>
          <div className="pet-grid">
            {settings.importedPets.map((pet) => (
              <button
                type="button"
                key={pet.id}
                className={pet.id === settings.activePet.id ? "pet-button active" : "pet-button"}
                onClick={() => void selectPet(pet)}
              >
                {pet.displayName}
              </button>
            ))}
          </div>
        </section>
      )}

      <button type="button" className="button" onClick={() => void resetGlobalPosition().then(setSettings)}>
        Reset Position
      </button>

      <button type="button" className="button secondary" onClick={() => void openPlayerPage()}>
        Open Animation Player
      </button>
    </main>
  );
}
