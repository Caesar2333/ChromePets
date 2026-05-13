import type { Position } from "./types";

export const DEFAULT_MARGIN = 24;
export const PET_CELL_WIDTH = 192;
export const PET_CELL_HEIGHT = 208;

export function getDefaultPosition(scale: number): Position {
  return {
    x: Math.max(DEFAULT_MARGIN, window.innerWidth - PET_CELL_WIDTH * scale - DEFAULT_MARGIN),
    y: Math.max(DEFAULT_MARGIN, window.innerHeight - PET_CELL_HEIGHT * scale - DEFAULT_MARGIN)
  };
}

export function clampPosition(position: Position, scale: number): Position {
  const width = PET_CELL_WIDTH * scale;
  const height = PET_CELL_HEIGHT * scale;
  return {
    x: Math.min(Math.max(0, position.x), Math.max(0, window.innerWidth - width)),
    y: Math.min(Math.max(0, position.y), Math.max(0, window.innerHeight - height))
  };
}

export function isOutsideViewport(position: Position, scale: number): boolean {
  const clamped = clampPosition(position, scale);
  return clamped.x !== position.x || clamped.y !== position.y;
}
