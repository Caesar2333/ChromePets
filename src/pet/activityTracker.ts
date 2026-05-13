import { PET_HOOKS } from "./hooks";
import type { PetHookEvent } from "./hooks";

interface ActivityTrackerOptions {
  dispatch: (event: PetHookEvent) => void;
  onPause: () => void;
  onResume: () => void;
  inactivityMs?: number;
}

export class ActivityTracker {
  private readonly dispatch: (event: PetHookEvent) => void;
  private readonly onPause: () => void;
  private readonly onResume: () => void;
  private readonly inactivityMs: number;
  private inactiveTimer: number | null = null;
  private scrollTimer: number | null = null;

  constructor(options: ActivityTrackerOptions) {
    this.dispatch = options.dispatch;
    this.onPause = options.onPause;
    this.onResume = options.onResume;
    this.inactivityMs = options.inactivityMs ?? 120_000;
    this.bind();
    this.scheduleInactive();
  }

  destroy(): void {
    window.removeEventListener("mousemove", this.onActivity);
    window.removeEventListener("keydown", this.onActivity);
    window.removeEventListener("pointerdown", this.onActivity);
    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    if (this.inactiveTimer !== null) window.clearTimeout(this.inactiveTimer);
    if (this.scrollTimer !== null) window.clearTimeout(this.scrollTimer);
  }

  private bind(): void {
    window.addEventListener("mousemove", this.onActivity, { passive: true });
    window.addEventListener("keydown", this.onActivity, { passive: true });
    window.addEventListener("pointerdown", this.onActivity, { passive: true });
    window.addEventListener("scroll", this.onScroll, true);
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private onActivity = (): void => {
    this.dispatch({ hook: PET_HOOKS.userActivity });
    this.scheduleInactive();
  };

  private onScroll = (): void => {
    this.dispatch({ hook: PET_HOOKS.pageScroll });
    this.onActivity();
    if (this.scrollTimer !== null) window.clearTimeout(this.scrollTimer);
    this.scrollTimer = window.setTimeout(() => {
      this.scrollTimer = null;
    }, 250);
  };

  private onFocus = (): void => {
    this.dispatch({ hook: PET_HOOKS.windowFocus });
    this.onActivity();
  };

  private onBlur = (): void => {
    this.dispatch({ hook: PET_HOOKS.windowBlur });
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.onPause();
      this.dispatch({ hook: PET_HOOKS.windowBlur });
    } else {
      this.onResume();
      this.dispatch({ hook: PET_HOOKS.windowFocus });
    }
  };

  private scheduleInactive(): void {
    if (this.inactiveTimer !== null) window.clearTimeout(this.inactiveTimer);
    this.inactiveTimer = window.setTimeout(() => {
      this.dispatch({ hook: PET_HOOKS.userInactive });
    }, this.inactivityMs);
  }
}
