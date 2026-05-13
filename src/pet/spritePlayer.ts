import { HATCH_PET_SPEC } from "./hatchPetSpec";
import type { HatchPetAnimationSpec, HatchPetState, SpritePlayerFrameInfo } from "./types";

interface SpritePlayerOptions {
  shell: HTMLElement;
  sprite: HTMLElement;
  spritesheetUrl: string;
  spec?: HatchPetAnimationSpec;
  initialScale: number;
  playbackRate?: number;
  onComplete?: (state: HatchPetState) => void;
  onFrame?: (info: SpritePlayerFrameInfo) => void;
}

export class HatchPetSpritePlayer {
  private readonly shell: HTMLElement;
  private readonly sprite: HTMLElement;
  private readonly spec: HatchPetAnimationSpec;
  private readonly onComplete?: (state: HatchPetState) => void;
  private readonly onFrame?: (info: SpritePlayerFrameInfo) => void;
  private animationFrame = 0;
  private paused = false;
  private destroyed = false;
  private currentState: HatchPetState = "idle";
  private frameIndex = 0;
  private frameStartedAt = performance.now();
  private playbackRate = 1;

  constructor(options: SpritePlayerOptions) {
    this.shell = options.shell;
    this.sprite = options.sprite;
    this.spec = options.spec || HATCH_PET_SPEC;
    this.onComplete = options.onComplete;
    this.onFrame = options.onFrame;
    this.playbackRate = Math.min(2, Math.max(0.25, options.playbackRate ?? 1));
    this.sprite.style.backgroundImage = `url("${options.spritesheetUrl}")`;
    this.sprite.style.backgroundSize = `${this.spec.atlas.atlasWidth}px ${this.spec.atlas.atlasHeight}px`;
    this.setScale(options.initialScale);
    this.applyFrame();
    this.tick = this.tick.bind(this);
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  play(state: HatchPetState): void {
    if (this.currentState === state && this.spec.states[state].loop) return;
    this.currentState = state;
    this.frameIndex = 0;
    this.frameStartedAt = performance.now();
    this.applyFrame();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.frameStartedAt = performance.now();
  }

  setScale(scale: number): void {
    this.shell.style.width = `${this.spec.atlas.cellWidth * scale}px`;
    this.shell.style.height = `${this.spec.atlas.cellHeight * scale}px`;
    this.sprite.style.transform = `scale(${scale})`;
  }

  setPlaybackRate(playbackRate: number): void {
    this.playbackRate = Math.min(2, Math.max(0.25, playbackRate));
  }

  getSnapshot(): SpritePlayerFrameInfo {
    const stateSpec = this.spec.states[this.currentState];
    const baseDuration = stateSpec.durations[this.frameIndex] ?? stateSpec.durations[stateSpec.durations.length - 1];
    const currentDuration = baseDuration / this.playbackRate;
    return {
      currentState: this.currentState,
      currentFrame: this.frameIndex,
      currentDuration,
      fps: currentDuration > 0 ? 1000 / currentDuration : 0
    };
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
  }

  private tick(now: number): void {
    if (this.destroyed) return;

    if (!this.paused) {
      const stateSpec = this.spec.states[this.currentState];
      const baseDuration = stateSpec.durations[this.frameIndex] ?? stateSpec.durations[stateSpec.durations.length - 1];
      const duration = baseDuration / this.playbackRate;
      if (now - this.frameStartedAt >= duration) {
        this.advanceFrame(now);
      }
    }

    this.animationFrame = requestAnimationFrame(this.tick);
  }

  private advanceFrame(now: number): void {
    const stateSpec = this.spec.states[this.currentState];
    const nextFrame = this.frameIndex + 1;
    this.frameStartedAt = now;

    if (nextFrame < stateSpec.frameCount) {
      this.frameIndex = nextFrame;
      this.applyFrame();
      return;
    }

    if (stateSpec.loop) {
      this.frameIndex = 0;
      this.applyFrame();
      return;
    }

    const completedState = this.currentState;
    this.onComplete?.(completedState);
  }

  private applyFrame(): void {
    const stateSpec = this.spec.states[this.currentState];
    const x = -this.frameIndex * this.spec.atlas.cellWidth;
    const y = -stateSpec.row * this.spec.atlas.cellHeight;
    this.sprite.style.backgroundPosition = `${x}px ${y}px`;
    this.onFrame?.(this.getSnapshot());
  }
}
