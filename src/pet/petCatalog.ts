import type { PetIdentity } from "./types";

export const FALLBACK_BUILT_IN_PETS: PetIdentity[] = [
  {
    id: "zheng-ke",
    displayName: "Zheng ke",
    description: "A compact Codex pet."
  },
  {
    id: "zhang-fei",
    displayName: "Zhang Fei",
    description: "A compact Codex pet."
  },
  {
    id: "guan-yu",
    displayName: "Guan Gong",
    description: "A compact Codex pet."
  },
  {
    id: "wasteMan",
    displayName: "Vault Boy",
    description: "A cheerful retro vault mascot pet with blond hair, a blue jumpsuit, yellow trim, and task-specific thumbs-up and wrist-computer poses."
  }
];

export const BUILT_IN_PETS = FALLBACK_BUILT_IN_PETS;
export const DEFAULT_ACTIVE_PET = FALLBACK_BUILT_IN_PETS[0];

export async function getBuiltInPets(): Promise<PetIdentity[]> {
  try {
    const response = await fetch("/pets/catalog.json");
    if (!response.ok) return FALLBACK_BUILT_IN_PETS;
    const pets = (await response.json()) as PetIdentity[];
    return normalizeBuiltInPets(pets);
  } catch {
    return FALLBACK_BUILT_IN_PETS;
  }
}

export function normalizeBuiltInPets(value: unknown): PetIdentity[] {
  if (!Array.isArray(value)) return FALLBACK_BUILT_IN_PETS;
  const pets = value
    .filter((pet): pet is PetIdentity => Boolean(pet?.id))
    .map((pet) => ({
      id: pet.id,
      displayName: pet.displayName || pet.id,
      description: pet.description,
      source: "built-in" as const,
      config: pet.config
    }));
  return pets.length > 0 ? pets : FALLBACK_BUILT_IN_PETS;
}

export function findBuiltInPet(petId: string | undefined, builtInPets: PetIdentity[] = FALLBACK_BUILT_IN_PETS): PetIdentity {
  return builtInPets.find((pet) => pet.id === petId) || builtInPets[0] || DEFAULT_ACTIVE_PET;
}

export function updateRecentPets(selectedPet: PetIdentity, recentPets: PetIdentity[]): PetIdentity[] {
  const rest = recentPets.filter((pet) => pet.id !== selectedPet.id);
  return [selectedPet, ...rest].slice(0, 4);
}

export function fillRecentPets(recentPets: PetIdentity[]): PetIdentity[] {
  const seen = new Set(recentPets.map((pet) => pet.id));
  const filled = [...recentPets];
  for (const pet of FALLBACK_BUILT_IN_PETS) {
    if (seen.has(pet.id)) continue;
    filled.push(pet);
    seen.add(pet.id);
    if (filled.length >= 4) break;
  }
  return filled.slice(0, 4);
}
