import { PET_HOOKS } from "./hooks";
import { clampPosition } from "./bounds";
import type { PetHookEvent } from "./hooks";
import type { PetSettings, Position } from "./types";

interface DragControllerOptions {
  shell: HTMLElement;
  getSettings: () => PetSettings;
  getPosition: () => Position;
  setPosition: (position: Position) => void;
  onPositionCommit: (position: Position) => void;
  dispatch: (event: PetHookEvent) => void;
}

export class DragController {
  private readonly shell: HTMLElement;
  private readonly getSettings: () => PetSettings;
  private readonly getPosition: () => Position;
  private readonly setPosition: (position: Position) => void;
  private readonly onPositionCommit: (position: Position) => void;
  private readonly dispatch: (event: PetHookEvent) => void;
  private pointerId: number | null = null;
  private startPointer: Position | null = null;
  private startPosition: Position | null = null;
  private lastPointerX: number | null = null;
  private isDragging = false;
  private previousUserSelect = "";

  constructor(options: DragControllerOptions) {
    this.shell = options.shell;
    this.getSettings = options.getSettings;
    this.getPosition = options.getPosition;
    this.setPosition = options.setPosition;
    this.onPositionCommit = options.onPositionCommit;
    this.dispatch = options.dispatch;
    this.shell.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove, { passive: false });
    window.addEventListener("pointerup", this.onPointerEnd);
    window.addEventListener("pointercancel", this.onPointerEnd);
  }

  destroy(): void {
    this.shell.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerEnd);
    window.removeEventListener("pointercancel", this.onPointerEnd);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.pointerId = event.pointerId;
    this.startPointer = { x: event.clientX, y: event.clientY };
    this.startPosition = this.getPosition();
    this.lastPointerX = event.clientX;
    this.isDragging = false;
    this.shell.setPointerCapture?.(event.pointerId);
    this.dispatch({ hook: PET_HOOKS.pointerDownPet, pointerX: event.clientX, pointerY: event.clientY });
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId || !this.startPointer || !this.startPosition) return;
    event.preventDefault();
    event.stopPropagation();

    const pointerDelta = {
      x: event.clientX - this.startPointer.x,
      y: event.clientY - this.startPointer.y
    };
    const distance = Math.hypot(pointerDelta.x, pointerDelta.y);
    const settings = this.getSettings();

    if (!this.isDragging && distance > 4) {
      this.isDragging = true;
      this.previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      this.dispatch({ hook: PET_HOOKS.dragStartPet, pointerX: event.clientX, pointerY: event.clientY });
      document.documentElement.classList.add("browser-pet-dragging");
    }

    if (!this.isDragging) return;

    const next = clampPosition(
      {
        x: this.startPosition.x + pointerDelta.x,
        y: this.startPosition.y + pointerDelta.y
      },
      settings.scale
    );
    this.setPosition(next);

    const directionHook = this.lastPointerX !== null && event.clientX < this.lastPointerX ? PET_HOOKS.dragMoveLeft : PET_HOOKS.dragMoveRight;
    this.lastPointerX = event.clientX;
    this.dispatch({ hook: directionHook, pointerX: event.clientX, pointerY: event.clientY });
  };

  private onPointerEnd = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.shell.releasePointerCapture?.(event.pointerId);
    document.documentElement.classList.remove("browser-pet-dragging");
    document.body.style.userSelect = this.previousUserSelect;
    if (this.isDragging) {
      this.onPositionCommit(this.getPosition());
      this.dispatch({ hook: PET_HOOKS.dragEndPet, pointerX: event.clientX, pointerY: event.clientY });
    }
    this.pointerId = null;
    this.startPointer = null;
    this.startPosition = null;
    this.isDragging = false;
  };
}
