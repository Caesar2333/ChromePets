import type { PetIdentity } from "./types";

export const BUILT_IN_PETS: PetIdentity[] = [
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

export const DEFAULT_ACTIVE_PET = BUILT_IN_PETS[0];

export function findBuiltInPet(petId: string): PetIdentity {
  return BUILT_IN_PETS.find((pet) => pet.id === petId) || DEFAULT_ACTIVE_PET;
}

export function updateRecentPets(selectedPet: PetIdentity, recentPets: PetIdentity[]): PetIdentity[] {
  const rest = recentPets.filter((pet) => pet.id !== selectedPet.id);
  return [selectedPet, ...rest].slice(0, 4);
}

export function fillRecentPets(recentPets: PetIdentity[]): PetIdentity[] {
  const seen = new Set(recentPets.map((pet) => pet.id));
  const filled = [...recentPets];
  for (const pet of BUILT_IN_PETS) {
    if (seen.has(pet.id)) continue;
    filled.push(pet);
    seen.add(pet.id);
    if (filled.length >= 4) break;
  }
  return filled.slice(0, 4);
}
