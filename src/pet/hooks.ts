import type { HatchPetState } from "./types";

export const PET_HOOKS = {
  extensionEnabled: "extension_enabled",
  extensionDisabled: "extension_disabled",
  pageLoaded: "page_loaded",
  petLoaded: "pet_loaded",
  mouseenterPet: "mouseenter_pet",
  mouseleavePet: "mouseleave_pet",
  clickPet: "click_pet",
  pointerDownPet: "pointer_down_pet",
  dragStartPet: "drag_start_pet",
  dragMoveLeft: "drag_move_left",
  dragMoveRight: "drag_move_right",
  dragEndPet: "drag_end_pet",
  userActivity: "user_activity",
  userInactive: "user_inactive",
  windowFocus: "window_focus",
  windowBlur: "window_blur",
  pageScroll: "page_scroll",
  viewportResize: "viewport_resize",
  assetMissing: "asset_missing",
  configError: "config_error",
  taskStart: "task_start",
  taskComplete: "task_complete",
  taskFailed: "task_failed",
  reviewStart: "review_start",
  reviewEnd: "review_end",
  waitingForUser: "waiting_for_user",
  debugForceState: "debug_force_state"
} as const;

export type PetHook = (typeof PET_HOOKS)[keyof typeof PET_HOOKS];

export interface PetHookEvent {
  hook: PetHook;
  targetState?: HatchPetState | null;
  pointerX?: number;
  pointerY?: number;
}
