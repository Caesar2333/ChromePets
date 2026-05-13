import type { HatchPetState, PetSettings, Position } from "../pet/types";

export const MESSAGE_TYPES = {
  settingsUpdated: "PET_SETTINGS_UPDATED",
  globalStateUpdated: "PET_GLOBAL_STATE_UPDATED",
  getGlobalState: "PET_GET_GLOBAL_STATE",
  updateGlobalState: "PET_UPDATE_GLOBAL_STATE",
  resetPosition: "PET_RESET_POSITION",
  forceState: "PET_FORCE_STATE",
  getStatus: "PET_GET_STATUS",
  statusResponse: "PET_STATUS_RESPONSE"
} as const;

export type PetMessage =
  | { type: typeof MESSAGE_TYPES.settingsUpdated; settings: PetSettings }
  | { type: typeof MESSAGE_TYPES.globalStateUpdated; settings: PetSettings }
  | { type: typeof MESSAGE_TYPES.getGlobalState }
  | { type: typeof MESSAGE_TYPES.updateGlobalState; patch: Partial<PetSettings> }
  | { type: typeof MESSAGE_TYPES.resetPosition }
  | { type: typeof MESSAGE_TYPES.forceState; forcedState: HatchPetState | null }
  | { type: typeof MESSAGE_TYPES.getStatus }
  | { type: typeof MESSAGE_TYPES.statusResponse; status: PetStatus };

export interface PetStatus {
  enabled: boolean;
  petId: string;
  state: HatchPetState;
  position: Position | null;
  scale: number;
  debugMode: boolean;
  forcedState: HatchPetState | null;
}
