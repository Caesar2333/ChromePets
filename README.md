# Codex Browser Pet Extension

Chrome / Edge Manifest V3 extension that injects a draggable Codex-compatible hatch-pet overlay into normal web pages.

## Pet Package Contract

Each pet package uses exactly two files:

```text
public/pets/<pet-id>/
  pet.json
  spritesheet.webp
```

The extension does not use GIFs, per-state images, `animations.json`, or a new pet manifest format. The built-in player uses the Codex hatch-pet atlas contract:

- 8 columns x 9 rows
- 192 x 208 cell size
- 1536 x 1872 atlas size
- rows: `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`

If `pet.json` is minimal, the default Hatch Pet animation spec in `src/pet/hatchPetSpec.ts` is used.

## Development

```bash
npm install
npm run dev
npm run build
```

Use `npm run dev` to open the browser-pet playground. It runs as a normal Vite web page and tests only `pet.json` loading, `spritesheet.webp` loading, `HatchPetSpritePlayer`, the 9 hatch-pet states, scale, and frame info.

Load `dist/` as an unpacked extension in Chrome or Edge.

Use `npm run build` or `npm run build:extension` to build the Chrome / Edge extension, then open `chrome://extensions`, enable Developer Mode, and load `dist/` as an unpacked extension.

## Behavior

- Default lower-right overlay plays `idle`.
- Hover maps to `review`.
- Click maps to one-shot `jumping`, then returns to `idle`.
- Dragging maps to `running-right` or `running-left` based on pointer direction.
- Inactivity and window blur map to `waiting`.
- Popup controls enable/disable, global scale, global reset position, recent pets, More built-in pets, and active pet switching.
- The service worker owns the global state in `chrome.storage.local`; content scripts render and sync that state across normal pages.

All animation frames are cropped from one `spritesheet.webp`; all pet metadata comes from one `pet.json`.
