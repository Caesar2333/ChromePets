import { HATCH_PET_STATES } from "../src/pet/hatchPetSpec";
import { loadPet, relativeResourceResolver } from "../src/pet/loadPet";
import { HatchPetSpritePlayer } from "../src/pet/spritePlayer";
import type { HatchPetState, SpritePlayerFrameInfo } from "../src/pet/types";

import "./style.css";

const shell = document.querySelector<HTMLElement>(".pet-shell");
const sprite = document.querySelector<HTMLElement>("#pet-sprite");
const buttons = document.querySelector<HTMLElement>("#state-buttons");
const scaleInput = document.querySelector<HTMLInputElement>("#scale");
const petName = document.querySelector<HTMLElement>("#pet-name");
const currentState = document.querySelector<HTMLElement>("#current-state");
const currentFrame = document.querySelector<HTMLElement>("#current-frame");
const timing = document.querySelector<HTMLElement>("#timing");
const spritesheetSize = document.querySelector<HTMLElement>("#spritesheet-size");
const scaleValue = document.querySelector<HTMLElement>("#scale-value");

if (!shell || !sprite || !buttons || !scaleInput || !petName || !currentState || !currentFrame || !timing || !spritesheetSize || !scaleValue) {
  throw new Error("Playground DOM is incomplete.");
}

function renderFrameInfo(info: SpritePlayerFrameInfo): void {
  currentState.textContent = info.currentState;
  currentFrame.textContent = String(info.currentFrame);
  timing.textContent = `${info.fps.toFixed(1)} fps / ${info.currentDuration} ms`;
}

function setScaleLabel(scale: number): void {
  scaleValue.textContent = `${scale.toFixed(1)}x`;
}

async function boot(): Promise<void> {
  const loadedPet = await loadPet("wasteland-helper", relativeResourceResolver);
  petName.textContent = `${loadedPet.config.displayName || loadedPet.config.id} (${loadedPet.config.id})`;
  spritesheetSize.textContent = `${loadedPet.spritesheetSize.width} x ${loadedPet.spritesheetSize.height}`;

  const player = new HatchPetSpritePlayer({
    shell,
    sprite,
    spritesheetUrl: loadedPet.spritesheetUrl,
    initialScale: Number(scaleInput.value),
    onFrame: renderFrameInfo,
    onComplete: (state) => {
      if (state === "waving" || state === "jumping" || state === "failed") {
        player.play("idle");
      }
    }
  });

  for (const state of HATCH_PET_STATES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = state;
    button.addEventListener("click", () => player.play(state));
    buttons.append(button);
  }

  scaleInput.addEventListener("input", () => {
    const scale = Number(scaleInput.value);
    player.setScale(scale);
    setScaleLabel(scale);
  });

  setScaleLabel(Number(scaleInput.value));
  renderFrameInfo(player.getSnapshot());
}

boot().catch((error) => {
  console.error(error);
  petName.textContent = "Failed to load pet package.";
});
