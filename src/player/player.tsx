import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HATCH_PET_SPEC, HATCH_PET_STATES } from "../pet/hatchPetSpec";
import { FALLBACK_BUILT_IN_PETS, getBuiltInPets } from "../pet/petCatalog";
import { loadPetIdentity, relativeResourceResolver } from "../pet/loadPet";
import { HatchPetSpritePlayer } from "../pet/spritePlayer";
import type { HatchPetState, PetIdentity, PetSettings, SpritePlayerFrameInfo } from "../pet/types";
import "./style.css";

const MESSAGE_TYPES = {
  getGlobalState: "PET_GET_GLOBAL_STATE"
} as const;

const DEFAULT_FRAME_INFO: SpritePlayerFrameInfo = {
  currentState: "review",
  currentFrame: 0,
  currentDuration: HATCH_PET_SPEC.states.review.durations[0],
  fps: 1000 / HATCH_PET_SPEC.states.review.durations[0]
};

interface PetPreview {
  spritesheetUrl: string;
  displayName: string;
}

function canUseExtensionApi(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.sendMessage);
}

async function getImportedPets(): Promise<PetIdentity[]> {
  if (!canUseExtensionApi()) return [];
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.getGlobalState });
    const settings = response?.settings as Partial<PetSettings> | undefined;
    return Array.isArray(settings?.importedPets) ? settings.importedPets.filter((pet): pet is PetIdentity => Boolean(pet?.id)) : [];
  } catch {
    return [];
  }
}

function getPetKey(pet: PetIdentity): string {
  return `${pet.source || "built-in"}:${pet.id}`;
}

function getRequestedPetId(): string | null {
  return new URLSearchParams(window.location.search).get("pet");
}

function getRequestedState(): HatchPetState | null {
  const action = new URLSearchParams(window.location.search).get("action");
  return HATCH_PET_STATES.includes(action as HatchPetState) ? (action as HatchPetState) : null;
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatFrameCount(state: HatchPetState): string {
  const stateSpec = HATCH_PET_SPEC.states[state];
  const totalMs = stateSpec.durations.reduce((total, duration) => total + duration, 0);
  return `${stateSpec.frameCount}f / ${formatDuration(totalMs)}`;
}

function getPreviewStyle(preview: PetPreview | undefined): React.CSSProperties {
  if (!preview) return {};
  return {
    backgroundImage: `url("${preview.spritesheetUrl}")`,
    backgroundSize: `${HATCH_PET_SPEC.atlas.atlasWidth}px ${HATCH_PET_SPEC.atlas.atlasHeight}px`,
    backgroundPosition: "0 0"
  };
}

function App() {
  const [builtInPets, setBuiltInPets] = useState<PetIdentity[]>(FALLBACK_BUILT_IN_PETS);
  const [pets, setPets] = useState<PetIdentity[]>(FALLBACK_BUILT_IN_PETS);
  const [selectedPetKey, setSelectedPetKey] = useState(getPetKey(FALLBACK_BUILT_IN_PETS[0]));
  const [selectedState, setSelectedState] = useState<HatchPetState>(getRequestedState() || "review");
  const [previews, setPreviews] = useState<Record<string, PetPreview>>({});
  const [frameInfo, setFrameInfo] = useState<SpritePlayerFrameInfo>(DEFAULT_FRAME_INFO);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loop, setLoop] = useState(true);
  const [scale, setScale] = useState(1.3);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [stageOffset, setStageOffset] = useState({ x: 0, y: 0 });
  const stageDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HatchPetSpritePlayer | null>(null);
  const stateRef = useRef(selectedState);
  const loopRef = useRef(loop);

  const selectedPet = useMemo(() => pets.find((pet) => getPetKey(pet) === selectedPetKey) || pets[0], [pets, selectedPetKey]);
  const currentStateSpec = HATCH_PET_SPEC.states[selectedState];
  const progress = currentStateSpec.frameCount > 1 ? (frameInfo.currentFrame / (currentStateSpec.frameCount - 1)) * 100 : 0;
  const importedCount = pets.filter((pet) => pet.source === "imported").length;
  const selectedPreview = selectedPet ? previews[getPetKey(selectedPet)] : undefined;

  useEffect(() => {
    void Promise.all([getBuiltInPets(), getImportedPets()]).then(([nextBuiltInPets, importedPets]) => {
      const nextPets = [...importedPets, ...nextBuiltInPets];
      const requestedPetId = getRequestedPetId();
      const requestedPet = nextPets.find((pet) => pet.id === requestedPetId);
      setBuiltInPets(nextBuiltInPets);
      setPets(nextPets);
      setSelectedPetKey(getPetKey(requestedPet || importedPets[0] || nextBuiltInPets[0]));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const nextPreviews: Record<string, PetPreview> = {};

    void Promise.all(
      pets.map(async (pet) => {
        try {
          const loaded = await loadPetIdentity(pet, relativeResourceResolver);
          if (cancelled) return;
          nextPreviews[getPetKey(pet)] = {
            spritesheetUrl: loaded.spritesheetUrl,
            displayName: loaded.config.displayName || pet.displayName
          };
        } catch {
          if (!cancelled) nextPreviews[getPetKey(pet)] = { spritesheetUrl: "", displayName: pet.displayName };
        }
      })
    ).then(() => {
      if (!cancelled) setPreviews(nextPreviews);
    });

    return () => {
      cancelled = true;
    };
  }, [pets]);

  useEffect(() => {
    stateRef.current = selectedState;
    playerRef.current?.play(selectedState);
  }, [selectedState]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    playerRef.current?.setScale(scale);
  }, [scale]);

  useEffect(() => {
    playerRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  useEffect(() => {
    if (!selectedPet || !shellRef.current || !spriteRef.current) return;
    let cancelled = false;
    setError(null);
    playerRef.current?.destroy();
    playerRef.current = null;

    void loadPetIdentity(selectedPet, relativeResourceResolver)
      .then((pet) => {
        if (cancelled || !shellRef.current || !spriteRef.current) return;
        const player = new HatchPetSpritePlayer({
          shell: shellRef.current,
          sprite: spriteRef.current,
          spritesheetUrl: pet.spritesheetUrl,
          initialScale: scale,
          playbackRate,
          onFrame: setFrameInfo,
          onComplete: (state) => {
            if (loopRef.current && state === stateRef.current) playerRef.current?.play(state);
          }
        });
        playerRef.current = player;
        player.play(selectedState);
        if (!isPlaying) player.pause();
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Pet package failed to load.");
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [selectedPet, scale, playbackRate]);

  useEffect(() => {
    if (isPlaying) {
      playerRef.current?.resume();
    } else {
      playerRef.current?.pause();
    }
  }, [isPlaying]);

  function replay(): void {
    playerRef.current?.play(selectedState);
    setIsPlaying(true);
  }

  function startStageDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stageDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: stageOffset.x,
      originY: stageOffset.y
    };
  }

  function moveStageDrag(event: React.PointerEvent<HTMLDivElement>): void {
    const drag = stageDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setStageOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY
    });
  }

  function endStageDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (stageDragRef.current?.pointerId !== event.pointerId) return;
    stageDragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <main className="player-page">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">P</span>
          <div>
            <h1>Pet Animation Player</h1>
            <p>Codex hatch-pet action preview</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={canUseExtensionApi() ? "status-pill success" : "status-pill"}>{canUseExtensionApi() ? "Extension page" : "Local preview"}</span>
          <button type="button" className="secondary-button" onClick={replay}>Replay</button>
        </div>
      </header>

      <section className="hero-band">
        <div className="hero-copy">
          <span className="hero-kicker">Animation workspace</span>
          <h2>Review every pet action in one focused player.</h2>
          <p>
            Browse imported and built-in pets, inspect the hatch-pet atlas contract, and test each row without touching
            the browser overlay runtime.
          </p>
          <div className="hero-actions">
            <button type="button" className="hero-primary" onClick={replay}>Play current action</button>
            <a className="hero-secondary" href="#workspace">Open workspace</a>
          </div>
        </div>
        <div className="hero-preview" aria-hidden="true">
          <div className="hero-preview-stage">
            <div className="hero-preview-pet" style={getPreviewStyle(selectedPreview)} />
          </div>
          <div className="hero-preview-meta">
            <span>{selectedPet?.displayName || "Pet"}</span>
            <strong>{selectedState}</strong>
          </div>
        </div>
      </section>

      <section className="metric-strip" aria-label="Player summary">
        <div>
          <span className="eyebrow">Animation library</span>
          <strong>{pets.length} pets detected</strong>
          <small>{importedCount} imported, {builtInPets.length} built-in</small>
        </div>
        <div>
          <span className="eyebrow">Atlas contract</span>
          <strong>{HATCH_PET_SPEC.atlas.columns}x{HATCH_PET_SPEC.atlas.rows}</strong>
          <small>{HATCH_PET_SPEC.atlas.cellWidth}x{HATCH_PET_SPEC.atlas.cellHeight} cells</small>
        </div>
        <div>
          <span className="eyebrow">Current action</span>
          <strong>{selectedState}</strong>
          <small>{formatFrameCount(selectedState)}</small>
        </div>
      </section>

      <div className="workspace" id="workspace">
        <aside className="panel pet-list" aria-label="Pet list">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Pets</span>
              <h2>Pet list</h2>
            </div>
            <span className="count">{pets.length}</span>
          </div>
          <div className="list-stack">
            {pets.map((pet) => {
              const petKey = getPetKey(pet);
              const preview = previews[petKey];
              return (
                <button
                  type="button"
                  key={petKey}
                  className={petKey === selectedPetKey ? "pet-card selected" : "pet-card"}
                  onClick={() => setSelectedPetKey(petKey)}
                >
                  <span className="pet-avatar">
                    {preview?.spritesheetUrl ? (
                      <span className="pet-thumb-frame">
                        <span className="pet-thumb" style={getPreviewStyle(preview)} />
                      </span>
                    ) : (
                      pet.displayName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span>
                    <strong>{preview?.displayName || pet.displayName}</strong>
                    <small>{pet.source === "imported" ? "Imported pet" : "Built-in pet"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <aside className="panel action-list" aria-label="Animation actions">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Actions</span>
              <h2>Animations</h2>
            </div>
            <span className="count">{HATCH_PET_STATES.length}</span>
          </div>
          <div className="list-stack">
            {HATCH_PET_STATES.map((state) => (
              <button
                type="button"
                key={state}
                className={state === selectedState ? "action-row selected" : "action-row"}
                onClick={() => setSelectedState(state)}
              >
                <span className="play-glyph" aria-hidden="true">&gt;</span>
                <span>{state}</span>
                <small>{formatFrameCount(state)}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="stage-shell">
          <div className="stage-header">
            <div>
              <span className="eyebrow">Live preview</span>
              <h2>{selectedPet?.displayName || "Pet"} / {selectedState}</h2>
            </div>
            <div className="preview-tools">
              <button type="button" className="icon-button" onClick={() => setScale((value) => Math.max(0.7, Number((value - 0.1).toFixed(1))))}>-</button>
              <button type="button" className="icon-button" onClick={() => setScale((value) => Math.min(2, Number((value + 0.1).toFixed(1))))}>+</button>
            </div>
          </div>

          <div
            className="stage"
            style={
              {
                "--stage-shift-x": `${stageOffset.x}px`,
                "--stage-shift-y": `${stageOffset.y}px`
              } as React.CSSProperties
            }
            onPointerDown={startStageDrag}
            onPointerMove={moveStageDrag}
            onPointerUp={endStageDrag}
            onPointerCancel={endStageDrag}
          >
            {error ? <div className="stage-error">{error}</div> : null}
            <div
              className="sprite-shell"
              ref={shellRef}
              style={{
                left: `calc(50% + ${stageOffset.x}px)`,
                top: `calc(50% + ${stageOffset.y}px)`
              }}
            >
              <div className="sprite-shadow" />
              <div className="sprite" ref={spriteRef} />
            </div>
          </div>

          <div className="transport">
            <button type="button" className="transport-button" onClick={replay}>Replay</button>
            <button type="button" className="play-button" onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? "Pause" : "Play"}</button>
            <label className="check">
              <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.currentTarget.checked)} />
              Loop
            </label>
            <label className="range-field">
              <span>Speed</span>
              <input type="range" min="0.25" max="2" step="0.05" value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.currentTarget.value))} />
              <strong>{playbackRate.toFixed(2)}x</strong>
            </label>
            <label className="range-field">
              <span>Scale</span>
              <input type="range" min="0.7" max="2" step="0.1" value={scale} onChange={(event) => setScale(Number(event.currentTarget.value))} />
              <strong>{scale.toFixed(1)}x</strong>
            </label>
          </div>

          <div className="timeline">
            <div className="timeline-meta">
              <span>Frame {frameInfo.currentFrame + 1} / {currentStateSpec.frameCount}</span>
              <span>{frameInfo.fps.toFixed(1)} FPS · {formatDuration(frameInfo.currentDuration)}</span>
            </div>
            <div className="timeline-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
