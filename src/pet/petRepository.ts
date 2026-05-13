import type { PetConfig, PetIdentity, StoredPetAsset } from "./types";

export const PET_REPOSITORY_KEY = "PET_REPOSITORY";

export interface PetRepository {
  imported: Record<string, StoredPetAsset>;
}

const EMPTY_REPOSITORY: PetRepository = {
  imported: {}
};

export function toImportedPetIdentity(asset: StoredPetAsset): PetIdentity {
  return {
    id: asset.id,
    displayName: asset.config.displayName || asset.id,
    description: asset.config.description,
    source: "imported",
    config: stripRuntimePetConfig(asset.config)
  };
}

export function stripRuntimePetConfig(config: PetConfig): PetConfig {
  return {
    id: config.id,
    displayName: config.displayName,
    description: config.description,
    spritesheetPath: config.spritesheetPath || "spritesheet.webp",
    browserPet: config.browserPet,
    animations: config.animations
  };
}

export async function getPetRepository(): Promise<PetRepository> {
  const stored = await chrome.storage.local.get({ [PET_REPOSITORY_KEY]: EMPTY_REPOSITORY });
  return normalizeRepository(stored[PET_REPOSITORY_KEY]);
}

export async function getStoredPetAsset(petId: string): Promise<StoredPetAsset | null> {
  const repository = await getPetRepository();
  return repository.imported[petId] || null;
}

export async function saveStoredPetAsset(asset: StoredPetAsset): Promise<PetRepository> {
  const repository = await getPetRepository();
  const next: PetRepository = {
    imported: {
      ...repository.imported,
      [asset.id]: {
        id: asset.id,
        config: stripRuntimePetConfig(asset.config),
        spritesheetDataUrl: asset.spritesheetDataUrl
      }
    }
  };
  await chrome.storage.local.set({ [PET_REPOSITORY_KEY]: next });
  return next;
}

export async function trimPetRepository(keepIds: string[]): Promise<void> {
  const keep = new Set(keepIds);
  const repository = await getPetRepository();
  const imported: Record<string, StoredPetAsset> = {};
  for (const [id, asset] of Object.entries(repository.imported)) {
    if (keep.has(id)) imported[id] = asset;
  }
  await chrome.storage.local.set({ [PET_REPOSITORY_KEY]: { imported } });
}

function normalizeRepository(value: unknown): PetRepository {
  if (!value || typeof value !== "object") return EMPTY_REPOSITORY;
  const importedValue = (value as { imported?: unknown }).imported;
  if (!importedValue || typeof importedValue !== "object") return EMPTY_REPOSITORY;

  const imported: Record<string, StoredPetAsset> = {};
  for (const [id, rawAsset] of Object.entries(importedValue)) {
    if (!rawAsset || typeof rawAsset !== "object") continue;
    const asset = rawAsset as Partial<StoredPetAsset>;
    if (!asset.config?.id || !asset.spritesheetDataUrl) continue;
    imported[id] = {
      id,
      config: stripRuntimePetConfig(asset.config),
      spritesheetDataUrl: asset.spritesheetDataUrl
    };
  }
  return { imported };
}
