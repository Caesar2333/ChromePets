import type { HatchPetAnimationSpec, HatchPetState } from "./types";

export const HATCH_PET_STATES: HatchPetState[] = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review"
];

export const HATCH_PET_SPEC: HatchPetAnimationSpec = {
  atlas: {
    columns: 8,
    rows: 9,
    cellWidth: 192,
    cellHeight: 208,
    atlasWidth: 1536,
    atlasHeight: 1872
  },
  states: {
    idle: { state: "idle", row: 0, frameCount: 6, durations: [280, 110, 110, 140, 140, 320], loop: true },
    "running-right": { state: "running-right", row: 1, frameCount: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220], loop: true },
    "running-left": { state: "running-left", row: 2, frameCount: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220], loop: true },
    waving: { state: "waving", row: 3, frameCount: 4, durations: [140, 140, 140, 280], loop: false, next: "idle" },
    jumping: { state: "jumping", row: 4, frameCount: 5, durations: [140, 140, 140, 140, 280], loop: false, next: "idle" },
    failed: { state: "failed", row: 5, frameCount: 8, durations: [140, 140, 140, 140, 140, 140, 140, 240], loop: false, next: "idle" },
    waiting: { state: "waiting", row: 6, frameCount: 6, durations: [150, 150, 150, 150, 150, 260], loop: true },
    running: { state: "running", row: 7, frameCount: 6, durations: [120, 120, 120, 120, 120, 220], loop: true },
    review: { state: "review", row: 8, frameCount: 6, durations: [150, 150, 150, 150, 150, 280], loop: true }
  }
};

export function isHatchPetState(value: unknown): value is HatchPetState {
  return typeof value === "string" && HATCH_PET_STATES.includes(value as HatchPetState);
}
