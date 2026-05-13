export type HatchPetState =
  | "idle"
  | "running-right"
  | "running-left"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review";

export type PetDirection = "left" | "right";

export interface HatchPetAtlasSpec {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  atlasWidth: number;
  atlasHeight: number;
}

export interface HatchPetStateSpec {
  state: HatchPetState;
  row: number;
  frameCount: number;
  durations: number[];
  loop: boolean;
  next?: HatchPetState;
}

export interface HatchPetAnimationSpec {
  atlas: HatchPetAtlasSpec;
  states: Record<HatchPetState, HatchPetStateSpec>;
}

export interface PetConfig {
  id: string;
  displayName?: string;
  description?: string;
  spritesheetPath?: string;
  browserPet?: unknown;
  animations?: unknown;
}

export interface PetIdentity {
  id: string;
  displayName: string;
  description?: string;
  source?: "built-in" | "imported";
  config?: PetConfig;
}

export interface StoredPetAsset {
  id: string;
  config: PetConfig;
  spritesheetDataUrl: string;
}

export interface LoadedPet {
  config: PetConfig;
  petJsonUrl: string;
  spritesheetUrl: string;
  hasAtlasWarning: boolean;
  spritesheetSize: {
    width: number;
    height: number;
  };
}

export type ResourceResolver = (path: string) => string;

export interface SpritePlayerFrameInfo {
  currentState: HatchPetState;
  currentFrame: number;
  currentDuration: number;
  fps: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface PetSettings {
  enabled: boolean;
  petId: string;
  activePet: PetIdentity;
  recentPets: PetIdentity[];
  scale: number;
  animationSpeed: number;
  position: Position | null;
  debugMode: boolean;
  forcedState: HatchPetState | null;
  currentAnimationState: HatchPetState;
  importedPets: PetIdentity[];
  lastUpdatedAt: number;
}
