import overlayCss from "./petOverlay.css?inline";
import { ActivityTracker } from "../pet/activityTracker";
import { clampPosition, getDefaultPosition, isOutsideViewport } from "../pet/bounds";
import { DragController } from "../pet/dragController";
import { PET_HOOKS } from "../pet/hooks";
import { loadPetIdentity } from "../pet/loadPet";
import { HatchPetSpritePlayer } from "../pet/spritePlayer";
import { PetStateMachine } from "../pet/stateMachine";
import type { PetHookEvent } from "../pet/hooks";
import type { PetSettings, Position } from "../pet/types";

interface BrowserPetOverlayOptions {
  onPositionCommit: (position: Position | null) => void;
}

export class BrowserPetOverlay {
  private root: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private shell: HTMLElement | null = null;
  private sprite: HTMLElement | null = null;
  private player: HatchPetSpritePlayer | null = null;
  private stateMachine: PetStateMachine | null = null;
  private dragController: DragController | null = null;
  private activityTracker: ActivityTracker | null = null;
  private settings: PetSettings | null = null;
  private position: Position | null = null;
  private petDisplayName = "";
  private readonly onPositionCommit: (position: Position | null) => void;

  constructor(options: BrowserPetOverlayOptions) {
    this.onPositionCommit = options.onPositionCommit;
  }

  async mount(settings: PetSettings): Promise<void> {
    this.settings = settings;
    if (!this.settings.enabled) return;

    this.createDom();
    this.position = clampPosition(this.settings.position || getDefaultPosition(this.settings.scale), this.settings.scale);
    this.applyPosition();

    this.stateMachine = new PetStateMachine({
      onStateChange: (state) => this.player?.play(state),
      onDisabled: () => this.destroy()
    });

    try {
      const loadedPet = await loadPetIdentity(this.settings.activePet);
      this.petDisplayName = loadedPet.config.displayName || loadedPet.config.id;
      if (!this.shell || !this.sprite || !this.settings) return;
      this.player = new HatchPetSpritePlayer({
        shell: this.shell,
        sprite: this.sprite,
        spritesheetUrl: loadedPet.spritesheetUrl,
        initialScale: this.settings.scale,
        playbackRate: this.settings.animationSpeed,
        onComplete: (state) => this.stateMachine?.complete(state)
      });
      if (loadedPet.hasAtlasWarning) this.dispatch({ hook: PET_HOOKS.assetMissing });
      this.dispatch({ hook: PET_HOOKS.petLoaded });
    } catch (error) {
      console.warn("[Codex Browser Pet] Failed to load pet package", error);
      this.showFallback("Pet package failed to load.");
      this.dispatch({ hook: PET_HOOKS.configError });
    }

    this.bindInteractions();
    this.dispatch({ hook: PET_HOOKS.pageLoaded });
  }

  destroy(): void {
    this.activityTracker?.destroy();
    this.dragController?.destroy();
    this.player?.destroy();
    window.removeEventListener("resize", this.onResize);
    this.root?.remove();
    this.root = null;
    this.shadow = null;
    this.shell = null;
    this.sprite = null;
    this.player = null;
    this.stateMachine = null;
    this.dragController = null;
    this.activityTracker = null;
  }

  getStatus() {
    return {
      enabled: this.settings?.enabled ?? false,
      petId: this.settings?.activePet.id ?? "wasteland-helper",
      state: this.stateMachine?.context.currentState ?? "idle",
      position: this.position,
      scale: this.settings?.scale ?? 1,
      debugMode: this.settings?.debugMode ?? false,
      forcedState: this.settings?.forcedState ?? null
    };
  }

  async applySettings(settings: PetSettings): Promise<void> {
    const previousPet = this.settings?.activePet;
    this.settings = settings;
    if (!settings.enabled) {
      this.dispatch({ hook: PET_HOOKS.extensionDisabled });
      this.destroy();
      return;
    }

    if (!this.root) {
      await this.mount(settings);
      return;
    }

    if (previousPet && this.hasPetChanged(previousPet, settings.activePet)) {
      await this.reloadPet(settings);
    }

    this.player?.setScale(settings.scale);
    this.player?.setPlaybackRate(settings.animationSpeed);
    this.position = clampPosition(settings.position || getDefaultPosition(settings.scale), settings.scale);
    this.applyPosition();
    this.stateMachine?.dispatch({ hook: PET_HOOKS.debugForceState, targetState: settings.forcedState });
  }

  async resetPosition(): Promise<void> {
    if (!this.settings) return;
    this.position = getDefaultPosition(this.settings.scale);
    this.applyPosition();
    this.onPositionCommit(null);
  }

  forceState(targetState: PetSettings["forcedState"]): void {
    this.settings = this.settings ? { ...this.settings, forcedState: targetState } : this.settings;
    this.dispatch({ hook: PET_HOOKS.debugForceState, targetState });
  }

  private createDom(): void {
    if (document.getElementById("browser-pet-root")) {
      throw new Error("Browser pet root already exists.");
    }

    this.root = document.createElement("browser-pet-root");
    this.root.id = "browser-pet-root";
    this.shadow = this.root.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = overlayCss;
    this.shell = document.createElement("div");
    this.shell.className = "pet-shell";
    this.shell.setAttribute("role", "button");
    this.shell.setAttribute("aria-label", "Codex browser pet");
    this.sprite = document.createElement("div");
    this.sprite.className = "pet-sprite";
    this.shell.append(this.sprite);
    this.shadow.append(style, this.shell);
    document.documentElement.append(this.root);
  }

  private bindInteractions(): void {
    if (!this.shell || !this.settings) return;
    this.shell.addEventListener("mouseenter", () => this.dispatch({ hook: PET_HOOKS.mouseenterPet }));
    this.shell.addEventListener("mouseleave", () => this.dispatch({ hook: PET_HOOKS.mouseleavePet }));
    this.shell.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.dispatch({ hook: PET_HOOKS.clickPet });
    });

    this.dragController = new DragController({
      shell: this.shell,
      getSettings: () => this.settings!,
      getPosition: () => this.position || getDefaultPosition(this.settings!.scale),
      setPosition: (position) => {
        this.position = position;
        this.applyPosition();
      },
      onPositionCommit: async (position) => {
        this.onPositionCommit(position);
      },
      dispatch: (event) => this.dispatch(event)
    });

    this.activityTracker = new ActivityTracker({
      dispatch: (event) => this.dispatch(event),
      onPause: () => this.player?.pause(),
      onResume: () => this.player?.resume()
    });

    window.addEventListener("resize", this.onResize);
  }

  private onResize = (): void => {
    if (!this.settings || !this.position) return;
    const wasOutside = isOutsideViewport(this.position, this.settings.scale);
    this.position = clampPosition(this.position, this.settings.scale);
    this.applyPosition();
    if (wasOutside) this.dispatch({ hook: PET_HOOKS.viewportResize });
  };

  private dispatch(event: PetHookEvent): void {
    this.stateMachine?.dispatch(event);
  }

  private applyPosition(): void {
    if (!this.shell || !this.position) return;
    this.shell.style.left = `${this.position.x}px`;
    this.shell.style.top = `${this.position.y}px`;
  }

  private showFallback(message: string): void {
    if (!this.shell) return;
    this.shell.textContent = "";
    const fallback = document.createElement("div");
    fallback.className = "pet-fallback";
    fallback.textContent = message;
    this.shell.append(fallback);
  }

  private async reloadPet(settings: PetSettings): Promise<void> {
    if (!this.shell || !this.sprite) return;
    this.player?.destroy();
    this.sprite.style.backgroundImage = "";
    this.sprite.textContent = "";
    try {
      const loadedPet = await loadPetIdentity(settings.activePet);
      this.petDisplayName = loadedPet.config.displayName || loadedPet.config.id;
      this.player = new HatchPetSpritePlayer({
        shell: this.shell,
        sprite: this.sprite,
        spritesheetUrl: loadedPet.spritesheetUrl,
        initialScale: settings.scale,
        playbackRate: settings.animationSpeed,
        onComplete: (state) => this.stateMachine?.complete(state)
      });
      this.dispatch({ hook: PET_HOOKS.petLoaded });
      this.dispatch({ hook: PET_HOOKS.taskComplete });
    } catch (error) {
      console.warn("[Codex Browser Pet] Failed to switch pet package", error);
      this.showFallback("Pet package failed to load.");
      this.dispatch({ hook: PET_HOOKS.configError });
    }
  }

  private hasPetChanged(previous: PetSettings["activePet"], next: PetSettings["activePet"]): boolean {
    return previous.id !== next.id || previous.source !== next.source;
  }
}
