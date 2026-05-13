import { HATCH_PET_SPEC, isHatchPetState } from "./hatchPetSpec";
import { PET_HOOKS, type PetHook, type PetHookEvent } from "./hooks";
import type { HatchPetState, PetDirection } from "./types";

type TaskMode = HatchPetState | null;
type InteractionMode = "jumping" | "waving" | null;

interface PetStateMachineContext {
  currentState: HatchPetState;
  previousState: HatchPetState | null;
  isEnabled: boolean;
  isDragging: boolean;
  isPointerInside: boolean;
  isUserInactive: boolean;
  forcedState: HatchPetState | null;
  lastPointerX: number | null;
  lastPointerY: number | null;
  currentDirection: PetDirection;
  lastActivityAt: number;
  hasError: boolean;
  taskMode: TaskMode;
  interactionMode: InteractionMode;
}

interface StateMachineOptions {
  onStateChange: (state: HatchPetState) => void;
  onDisabled?: () => void;
}

const ONE_SHOT_STATES = new Set<HatchPetState>(["failed", "jumping", "waving"]);

export class PetStateMachine {
  private readonly onStateChange: (state: HatchPetState) => void;
  private readonly onDisabled?: () => void;
  private transientTimer: number | null = null;

  readonly context: PetStateMachineContext = {
    currentState: "idle",
    previousState: null,
    isEnabled: true,
    isDragging: false,
    isPointerInside: false,
    isUserInactive: false,
    forcedState: null,
    lastPointerX: null,
    lastPointerY: null,
    currentDirection: "right",
    lastActivityAt: Date.now(),
    hasError: false,
    taskMode: null,
    interactionMode: null
  };

  private readonly handlers: Partial<Record<PetHook, (event: PetHookEvent) => void>> = {
    [PET_HOOKS.extensionEnabled]: () => {
      this.context.isEnabled = true;
    },
    [PET_HOOKS.extensionDisabled]: () => {
      this.context.isEnabled = false;
      this.onDisabled?.();
    },
    [PET_HOOKS.pageLoaded]: () => this.markActivity(),
    [PET_HOOKS.petLoaded]: () => this.markActivity(),
    [PET_HOOKS.mouseenterPet]: () => {
      this.context.isPointerInside = true;
      this.context.interactionMode = "waving";
    },
    [PET_HOOKS.mouseleavePet]: () => {
      this.context.isPointerInside = false;
      if (this.context.interactionMode === "waving") this.context.interactionMode = null;
    },
    [PET_HOOKS.clickPet]: () => {
      this.context.interactionMode = "jumping";
    },
    [PET_HOOKS.pointerDownPet]: (event) => {
      this.context.lastPointerX = event.pointerX ?? this.context.lastPointerX;
      this.context.lastPointerY = event.pointerY ?? this.context.lastPointerY;
    },
    [PET_HOOKS.dragStartPet]: (event) => this.startDrag(event),
    [PET_HOOKS.dragMoveLeft]: (event) => this.moveDrag("left", event),
    [PET_HOOKS.dragMoveRight]: (event) => this.moveDrag("right", event),
    [PET_HOOKS.dragEndPet]: () => {
      this.context.isDragging = false;
    },
    [PET_HOOKS.userActivity]: () => {
      this.context.isUserInactive = false;
      this.markActivity();
    },
    [PET_HOOKS.userInactive]: () => {
      this.context.isUserInactive = true;
      this.context.taskMode = "waiting";
    },
    [PET_HOOKS.windowFocus]: () => {
      this.context.isUserInactive = false;
      if (this.context.taskMode === "waiting") this.context.taskMode = null;
    },
    [PET_HOOKS.windowBlur]: () => {
      this.context.taskMode = "waiting";
    },
    [PET_HOOKS.pageScroll]: () => this.playTransient("review", 900),
    [PET_HOOKS.viewportResize]: () => this.playTransient("failed", HATCH_PET_SPEC.states.failed.durations.reduce((a, b) => a + b, 0)),
    [PET_HOOKS.assetMissing]: () => {
      this.context.hasError = true;
    },
    [PET_HOOKS.configError]: () => {
      this.context.hasError = true;
    },
    [PET_HOOKS.taskStart]: () => {
      this.context.taskMode = "running";
    },
    [PET_HOOKS.taskComplete]: () => {
      this.context.taskMode = null;
      this.context.interactionMode = "waving";
    },
    [PET_HOOKS.taskFailed]: () => {
      this.context.hasError = true;
    },
    [PET_HOOKS.reviewStart]: () => {
      this.context.taskMode = "review";
    },
    [PET_HOOKS.reviewEnd]: () => {
      if (this.context.taskMode === "review") this.context.taskMode = null;
    },
    [PET_HOOKS.waitingForUser]: () => {
      this.context.taskMode = "waiting";
    },
    [PET_HOOKS.debugForceState]: (event) => {
      this.context.forcedState = isHatchPetState(event.targetState) ? event.targetState : null;
    }
  };

  constructor(options: StateMachineOptions) {
    this.onStateChange = options.onStateChange;
    this.onDisabled = options.onDisabled;
  }

  dispatch(event: PetHookEvent): HatchPetState {
    this.handlers[event.hook]?.(event);
    return this.resolve();
  }

  complete(state: HatchPetState): HatchPetState {
    if (ONE_SHOT_STATES.has(state)) {
      if (state === "failed") this.context.hasError = false;
      if (this.context.interactionMode === state) this.context.interactionMode = null;
      if (state === "jumping" || state === "waving") this.context.isPointerInside = false;
      return this.resolve();
    }
    return this.context.currentState;
  }

  setEnabled(enabled: boolean): void {
    this.dispatch({ hook: enabled ? PET_HOOKS.extensionEnabled : PET_HOOKS.extensionDisabled });
  }

  private resolve(): HatchPetState {
    const nextState = this.pickState();
    if (nextState !== this.context.currentState) {
      this.context.previousState = this.context.currentState;
      this.context.currentState = nextState;
      this.onStateChange(nextState);
    }
    return nextState;
  }

  private pickState(): HatchPetState {
    if (!this.context.isEnabled) return "idle";
    if (this.context.isDragging) return this.context.currentDirection === "left" ? "running-left" : "running-right";
    if (this.context.hasError) return "failed";
    if (this.context.forcedState) return this.context.forcedState;
    if (this.context.taskMode) return this.context.taskMode;
    if (this.context.interactionMode) return this.context.interactionMode;
    if (this.context.isPointerInside) return "review";
    return "idle";
  }

  private startDrag(event: PetHookEvent): void {
    this.context.isDragging = true;
    this.updatePointer(event);
  }

  private moveDrag(direction: PetDirection, event: PetHookEvent): void {
    this.context.currentDirection = direction;
    this.context.isDragging = true;
    this.updatePointer(event);
  }

  private updatePointer(event: PetHookEvent): void {
    this.context.lastPointerX = event.pointerX ?? this.context.lastPointerX;
    this.context.lastPointerY = event.pointerY ?? this.context.lastPointerY;
  }

  private markActivity(): void {
    this.context.lastActivityAt = Date.now();
    if (this.context.taskMode === "waiting") this.context.taskMode = null;
  }

  private playTransient(state: HatchPetState, duration: number): void {
    this.context.taskMode = state;
    if (this.transientTimer !== null) window.clearTimeout(this.transientTimer);
    this.transientTimer = window.setTimeout(() => {
      if (this.context.taskMode === state) {
        this.context.taskMode = null;
        this.resolve();
      }
      this.transientTimer = null;
    }, duration);
  }
}
