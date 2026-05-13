import { HATCH_PET_SPEC } from "./hatchPetSpec";
import type { LoadedPet, PetConfig, PetIdentity, ResourceResolver, StoredPetAsset } from "./types";

const PET_REPOSITORY_KEY = "PET_REPOSITORY";

export const extensionResourceResolver: ResourceResolver = (path: string) => {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return `/${path}`;
};

export const relativeResourceResolver: ResourceResolver = (path: string) => `/${path}`;

function imageLoaded(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load spritesheet: ${url}`));
    image.src = url;
  });
}

export async function loadPet(petId: string, resolveResource: ResourceResolver = extensionResourceResolver): Promise<LoadedPet> {
  const petJsonUrl = resolveResource(`pets/${petId}/pet.json`);
  const response = await fetch(petJsonUrl);
  if (!response.ok) {
    throw new Error(`Missing pet.json for ${petId}`);
  }

  const config = (await response.json()) as PetConfig;
  if (!config.id) {
    throw new Error(`Invalid pet.json for ${petId}: missing id`);
  }

  const spritesheetPath = config.spritesheetPath || "spritesheet.webp";
  const spritesheetUrl = resolveResource(`pets/${petId}/${spritesheetPath}`);
  const image = await imageLoaded(spritesheetUrl);
  const expected = HATCH_PET_SPEC.atlas;
  const hasAtlasWarning = image.naturalWidth !== expected.atlasWidth || image.naturalHeight !== expected.atlasHeight;

  if (hasAtlasWarning) {
    console.warn(
      `[Codex Browser Pet] spritesheet size mismatch: expected ${expected.atlasWidth}x${expected.atlasHeight}, got ${image.naturalWidth}x${image.naturalHeight}`
    );
  }

  return {
    config: { ...config, spritesheetPath },
    petJsonUrl,
    spritesheetUrl,
    hasAtlasWarning,
    spritesheetSize: {
      width: image.naturalWidth,
      height: image.naturalHeight
    }
  };
}

export async function loadPetIdentity(pet: PetIdentity, resolveResource: ResourceResolver = extensionResourceResolver): Promise<LoadedPet> {
  if (pet.source !== "imported") {
    return loadPet(pet.id, resolveResource);
  }

  const storedAsset = await getStoredPetAsset(pet.id);
  if (!storedAsset?.config?.id || !storedAsset.spritesheetDataUrl) {
    throw new Error(`Imported pet ${pet.id} is missing pet.json or spritesheet.webp data in the pet repository.`);
  }

  const spritesheetUrl = await dataUrlToObjectUrl(storedAsset.spritesheetDataUrl);
  const image = await imageLoaded(spritesheetUrl);
  const expected = HATCH_PET_SPEC.atlas;
  const hasAtlasWarning = image.naturalWidth !== expected.atlasWidth || image.naturalHeight !== expected.atlasHeight;

  if (hasAtlasWarning) {
    console.warn(
      `[Codex Browser Pet] imported spritesheet size mismatch: expected ${expected.atlasWidth}x${expected.atlasHeight}, got ${image.naturalWidth}x${image.naturalHeight}`
    );
  }

  return {
    config: { ...storedAsset.config, spritesheetPath: storedAsset.config.spritesheetPath || "spritesheet.webp" },
    petJsonUrl: `imported:${pet.id}/pet.json`,
    spritesheetUrl,
    hasAtlasWarning,
    spritesheetSize: {
      width: image.naturalWidth,
      height: image.naturalHeight
    }
  };
}

async function dataUrlToObjectUrl(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function getStoredPetAsset(petId: string): Promise<StoredPetAsset | null> {
  const stored = await chrome.storage.local.get({ [PET_REPOSITORY_KEY]: { imported: {} } });
  const repository = stored[PET_REPOSITORY_KEY] as { imported?: Record<string, StoredPetAsset> } | undefined;
  const asset = repository?.imported?.[petId];
  if (!asset?.config?.id || !asset.spritesheetDataUrl) return null;
  return asset;
}
