import { useEffect, useRef, useState } from "react";
import { saveStoredPetAsset, stripRuntimePetConfig, toImportedPetIdentity, trimPetRepository } from "../pet/petRepository";
import type { PetConfig, PetIdentity, PetSettings } from "../pet/types";

const BUILT_IN_PETS: PetIdentity[] = [
  {
    id: "wasteland-helper",
    displayName: "Wasteland Helper",
    description: "A retro-future wasteland survivor desktop pet."
  },
  {
    id: "strangetech",
    displayName: "StrangeTech",
    description: "A tiny mystic-tech sorcerer pet."
  },
  {
    id: "wasteland-helper-classic",
    displayName: "Wasteland Classic",
    description: "A classic preset variant of the wasteland helper pet."
  },
  {
    id: "strangetech-focus",
    displayName: "StrangeTech Focus",
    description: "A focus preset variant of the mystic-tech sorcerer pet."
  }
];

const DEFAULT_ACTIVE_PET = BUILT_IN_PETS[0];

const DEFAULT_SETTINGS: PetSettings = {
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

const MESSAGE_TYPES = {
  getGlobalState: "PET_GET_GLOBAL_STATE",
  updateGlobalState: "PET_UPDATE_GLOBAL_STATE",
  resetPosition: "PET_RESET_POSITION"
} as const;

function findBuiltInPet(petId: string): PetIdentity {
  return BUILT_IN_PETS.find((pet) => pet.id === petId) || DEFAULT_ACTIVE_PET;
}

function findAvailablePet(petId: string, importedPets: PetIdentity[]): PetIdentity {
  return importedPets.find((pet) => pet.id === petId) || findBuiltInPet(petId);
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

function normalizeState(value: Partial<PetSettings> | undefined): PetSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(value || {}) };
  const importedPets = normalizeImportedPets(merged.importedPets);
  const activePet = merged.activePet?.id ? findAvailablePet(merged.activePet.id, importedPets) : findAvailablePet(merged.petId, importedPets);

  return {
    enabled: Boolean(merged.enabled),
    petId: activePet.id,
    activePet,
    recentPets: BUILT_IN_PETS.slice(0, 4),
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

async function updateGlobalState(patch: Partial<PetSettings>): Promise<PetSettings> {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.updateGlobalState, patch });
  return normalizeState(response?.settings);
}

async function resetGlobalPosition(): Promise<PetSettings> {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.resetPosition });
  return normalizeState(response?.settings);
}

export function ControlPanel() {
  const [settings, setSettings] = useState<PetSettings>(DEFAULT_SETTINGS);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void getGlobalState().then(setSettings);
  }, []);

  useEffect(() => {
    fileInputRef.current?.setAttribute("webkitdirectory", "");
    fileInputRef.current?.setAttribute("directory", "");
  }, []);

  async function patchState(patch: Partial<PetSettings>): Promise<void> {
    setSettings(await updateGlobalState(patch));
  }

  async function selectPet(pet: PetIdentity): Promise<void> {
    await patchState({
      activePet: pet,
      petId: pet.id,
      currentAnimationState: "idle"
    });
  }

  async function importPet(files: FileList | null): Promise<void> {
    setImportError("");
    if (!files) return;

    const fileArray = Array.from(files);
    const jsonFile = findPetPackageFile(fileArray, "pet.json");
    const webpFile = findPetPackageFile(fileArray, "spritesheet.webp");

    if (!jsonFile || !webpFile) {
      setImportError("Select a pet package folder containing pet.json and spritesheet.webp.");
      return;
    }

    try {
      const config = JSON.parse(await jsonFile.text()) as PetConfig;
      if (!config.id) throw new Error("pet.json is missing id.");
      const spritesheetDataUrl = await readAsDataUrl(webpFile);
      const asset = {
        id: config.id,
        config: stripRuntimePetConfig(config),
        spritesheetDataUrl
      };
      await saveStoredPetAsset(asset);
      const importedPet = toImportedPetIdentity(asset);
      const importedPets = [importedPet, ...settings.importedPets.filter((pet) => pet.id !== importedPet.id)].slice(0, 4);
      await trimPetRepository(importedPets.map((pet) => pet.id));
      await patchState({
        importedPets,
        activePet: importedPet,
        petId: importedPet.id,
        currentAnimationState: "idle"
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import pet package.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          {BUILT_IN_PETS.map((pet) => (
            <button
              type="button"
              key={pet.id}
              className={pet.id === settings.activePet.id ? "pet-button active" : "pet-button"}
              onClick={() => void selectPet(pet)}
            >
              {pet.displayName}
            </button>
          ))}
          <button type="button" className="pet-button more" onClick={() => fileInputRef.current?.click()}>
            More
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => void importPet(event.currentTarget.files)}
        />
      </section>

      {settings.importedPets.length > 0 && (
        <section className="field more-panel">
          <div className="field-row">
            <label>Imported Pets</label>
            <span>{settings.importedPets.length}/4</span>
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

      {importError && <p className="error">{importError}</p>}

      <button type="button" className="button" onClick={() => void resetGlobalPosition().then(setSettings)}>
        Reset Position
      </button>
    </main>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read spritesheet.webp."));
    reader.readAsDataURL(file);
  });
}

function findPetPackageFile(files: File[], fileName: "pet.json" | "spritesheet.webp"): File | undefined {
  const exactRootMatch = files.find((file) => file.name.toLowerCase() === fileName);
  if (exactRootMatch) return exactRootMatch;

  return files.find((file) => {
    const relativePath = "webkitRelativePath" in file ? String(file.webkitRelativePath).replace(/\\/g, "/").toLowerCase() : "";
    return relativePath.endsWith(`/${fileName}`) || relativePath === fileName;
  });
}
