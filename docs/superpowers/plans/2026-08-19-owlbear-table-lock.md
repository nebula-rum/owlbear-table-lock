# Owlbear Rodeo Table Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Table Lock milestone: a GM can choose one scene item as the tabletop, enable a scene-level lock, and every client is prevented from zooming out past the scale where that tabletop fits in their local viewport; all users also get a Fit Table action.

**Architecture:** A small Vite + TypeScript Owlbear extension uses scene metadata for shared configuration and a local polling controller for viewport enforcement. Pure math for fit-scale computation is isolated and unit-tested; Owlbear SDK calls are isolated behind small state/controller modules so the UI stays simple. This milestone intentionally implements zoom clamping only; pan clamping remains disabled until zoom behavior is verified interactively, per the approved design.

**Tech Stack:** TypeScript, Vite, `@owlbear-rodeo/sdk`, Vitest, vanilla HTML/CSS.

**Spec:** `docs/superpowers/specs/2026-08-19-owlbear-table-lock-design.md`

## Global Constraints

- Use only documented Owlbear Rodeo extension APIs.
- Store the configured table object ID in scene metadata under `com.astroprisma.table-lock/tableItemId`.
- Store the scene-level enabled flag under `com.astroprisma.table-lock/enabled`.
- Reserve `com.astroprisma.table-lock/clampPan` for the later pan-clamp milestone; this plan does not enable pan clamping.
- Each client derives its own minimum scale from the shared table bounds and its own viewport dimensions.
- Zooming in must remain unrestricted.
- If no valid table is configured, enforcement must do nothing.
- Non-GM players cannot change scene-level configuration.
- Temporary SDK errors must skip the current enforcement tick rather than move the camera unpredictably.
- Initial polling interval: `75 ms`, within the approved design's 50–100 ms range.
- Do not call viewport setters when the current scale is already valid.

---

## File Structure

- `package.json` — scripts and dependencies for Vite, TypeScript, SDK, and Vitest.
- `tsconfig.json` — TypeScript compiler settings.
- `vite.config.ts` — Vite configuration including Owlbear CORS allowance during development.
- `index.html` — action-popover entry point.
- `public/manifest.json` — Owlbear extension manifest.
- `public/icon.svg` — Table Lock action icon.
- `src/constants.ts` — extension ID, metadata keys, polling interval.
- `src/tableMath.ts` — pure fit-scale calculation and validity helpers.
- `src/tableMath.test.ts` — unit tests for fit-scale behavior.
- `src/state.ts` — typed scene metadata reads/writes and table-item lookup/bounds validation.
- `src/state.test.ts` — tests for metadata normalization independent of live Owlbear APIs.
- `src/enforcer.ts` — start/stop lifecycle and zoom-clamp polling loop.
- `src/enforcer.test.ts` — controller tests with a fake viewport adapter.
- `src/main.ts` — Owlbear initialization, role/scene listeners, UI wiring.
- `src/style.css` — compact action-popover styling.

---

### Task 1: Scaffold the Extension and Lock Down Fit-Scale Math

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `public/manifest.json`
- Create: `public/icon.svg`
- Create: `src/constants.ts`
- Create: `src/tableMath.ts`
- Create: `src/tableMath.test.ts`

**Interfaces:**
- Consumes: Owlbear's documented viewport convention that scale `1` is 1:1 scene-to-screen scale, and `getWidth()` / `getHeight()` return local viewport dimensions.
- Produces: `computeFitScale(tableWidth: number, tableHeight: number, viewportWidth: number, viewportHeight: number): number` and `isPositiveFinite(value: number): boolean`.

- [ ] **Step 1: Create the minimal Vite/TypeScript project files**

`package.json`:

```json
{
  "name": "owlbear-table-lock",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@owlbear-rodeo/sdk": "latest"
  },
  "devDependencies": {
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
});
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Table Lock</title>
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`public/manifest.json`:

```json
{
  "name": "Table Lock",
  "version": "0.1.0",
  "manifest_version": 1,
  "action": {
    "title": "Table Lock",
    "icon": "/icon.svg",
    "popover": "/",
    "height": 330,
    "width": 320
  }
}
```

`public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4" y="7" width="16" height="13" rx="2" />
  <path d="M8 7V5a4 4 0 0 1 8 0v2" />
</svg>
```

`src/constants.ts`:

```ts
export const EXTENSION_ID = "com.astroprisma.table-lock";
export const TABLE_ITEM_ID_KEY = `${EXTENSION_ID}/tableItemId`;
export const ENABLED_KEY = `${EXTENSION_ID}/enabled`;
export const CLAMP_PAN_KEY = `${EXTENSION_ID}/clampPan`;
export const POLL_INTERVAL_MS = 75;
export const SCALE_EPSILON = 0.0001;
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `node_modules/` and a lockfile are created without dependency-resolution errors.

- [ ] **Step 3: Write the failing fit-scale tests**

`src/tableMath.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeFitScale, isPositiveFinite } from "./tableMath";

describe("computeFitScale", () => {
  it("fits a same-aspect table exactly", () => {
    expect(computeFitScale(1600, 900, 800, 450)).toBeCloseTo(0.5);
  });

  it("uses the width-limited scale for a relatively narrow viewport", () => {
    expect(computeFitScale(1600, 900, 800, 800)).toBeCloseTo(0.5);
  });

  it("uses the height-limited scale for a relatively wide viewport", () => {
    expect(computeFitScale(1000, 1000, 1600, 900)).toBeCloseTo(0.9);
  });

  it("rejects zero-sized table bounds", () => {
    expect(() => computeFitScale(0, 900, 800, 450)).toThrow();
  });

  it("rejects zero-sized viewports", () => {
    expect(() => computeFitScale(1600, 900, 0, 450)).toThrow();
  });
});

describe("isPositiveFinite", () => {
  it("accepts positive finite values only", () => {
    expect(isPositiveFinite(1)).toBe(true);
    expect(isPositiveFinite(0)).toBe(false);
    expect(isPositiveFinite(-1)).toBe(false);
    expect(isPositiveFinite(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isPositiveFinite(Number.NaN)).toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests and verify they fail**

Run:

```bash
npm test -- src/tableMath.test.ts
```

Expected: FAIL because `src/tableMath.ts` does not exist or does not export the required functions.

- [ ] **Step 5: Implement the minimal fit-scale math**

`src/tableMath.ts`:

```ts
export function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function computeFitScale(
  tableWidth: number,
  tableHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const values = [tableWidth, tableHeight, viewportWidth, viewportHeight];
  if (!values.every(isPositiveFinite)) {
    throw new Error("Table and viewport dimensions must be positive finite values");
  }

  return Math.min(viewportWidth / tableWidth, viewportHeight / tableHeight);
}
```

- [ ] **Step 6: Run the unit tests**

Run:

```bash
npm test -- src/tableMath.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 7: Commit the scaffold and math**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html public src/constants.ts src/tableMath.ts src/tableMath.test.ts
git commit -m "feat: scaffold table lock and fit-scale math"
```

---

### Task 2: Add Typed Scene Configuration and Table-Bounds Lookup

**Files:**
- Create: `src/state.ts`
- Create: `src/state.test.ts`

**Interfaces:**
- Consumes: metadata keys from `src/constants.ts`; Owlbear `OBR.scene.getMetadata`, `OBR.scene.setMetadata`, `OBR.scene.items.getItems`, and `OBR.scene.items.getItemBounds`.
- Produces: `TableLockConfig`, `readConfig()`, `writeTableItemId(id)`, `writeEnabled(enabled)`, `clearTableItemId()`, `getConfiguredTableBounds(config)` and pure `normalizeConfig(metadata)`.

- [ ] **Step 1: Write failing configuration-normalization tests**

`src/state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ENABLED_KEY, TABLE_ITEM_ID_KEY } from "./constants";
import { normalizeConfig } from "./state";

describe("normalizeConfig", () => {
  it("returns safe defaults for an empty metadata object", () => {
    expect(normalizeConfig({})).toEqual({
      tableItemId: null,
      enabled: false,
    });
  });

  it("reads valid namespaced metadata", () => {
    expect(
      normalizeConfig({
        [TABLE_ITEM_ID_KEY]: "map-123",
        [ENABLED_KEY]: true,
      }),
    ).toEqual({
      tableItemId: "map-123",
      enabled: true,
    });
  });

  it("ignores values of the wrong type", () => {
    expect(
      normalizeConfig({
        [TABLE_ITEM_ID_KEY]: 42,
        [ENABLED_KEY]: "yes",
      }),
    ).toEqual({
      tableItemId: null,
      enabled: false,
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/state.test.ts
```

Expected: FAIL because `normalizeConfig` is not implemented.

- [ ] **Step 3: Implement scene configuration and bounds validation**

`src/state.ts`:

```ts
import OBR, { type BoundingBox, type Metadata } from "@owlbear-rodeo/sdk";
import { ENABLED_KEY, TABLE_ITEM_ID_KEY } from "./constants";

export interface TableLockConfig {
  tableItemId: string | null;
  enabled: boolean;
}

export function normalizeConfig(metadata: Metadata): TableLockConfig {
  const rawId = metadata[TABLE_ITEM_ID_KEY];
  const rawEnabled = metadata[ENABLED_KEY];
  return {
    tableItemId: typeof rawId === "string" && rawId.length > 0 ? rawId : null,
    enabled: typeof rawEnabled === "boolean" ? rawEnabled : false,
  };
}

export async function readConfig(): Promise<TableLockConfig> {
  return normalizeConfig(await OBR.scene.getMetadata());
}

export async function writeTableItemId(id: string): Promise<void> {
  await OBR.scene.setMetadata({ [TABLE_ITEM_ID_KEY]: id });
}

export async function clearTableItemId(): Promise<void> {
  await OBR.scene.setMetadata({
    [TABLE_ITEM_ID_KEY]: null,
    [ENABLED_KEY]: false,
  });
}

export async function writeEnabled(enabled: boolean): Promise<void> {
  await OBR.scene.setMetadata({ [ENABLED_KEY]: enabled });
}

export async function getConfiguredTableBounds(
  config: TableLockConfig,
): Promise<BoundingBox | null> {
  if (!config.tableItemId) return null;

  const items = await OBR.scene.items.getItems([config.tableItemId]);
  if (items.length !== 1) return null;

  const bounds = await OBR.scene.items.getItemBounds([config.tableItemId]);
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return null;
  }
  return bounds;
}
```

- [ ] **Step 4: Run the state tests**

Run:

```bash
npm test -- src/state.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Type-check the SDK-facing code**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS. If the SDK's `Metadata` type does not accept `null` for metadata deletion, use the SDK-supported metadata value for clearing while preserving the externally visible `normalizeConfig` behavior; do not weaken TypeScript strictness.

- [ ] **Step 6: Commit configuration state handling**

```bash
git add src/state.ts src/state.test.ts
git commit -m "feat: store table lock configuration in scene metadata"
```

---

### Task 3: Build and Test the Local Zoom Enforcement Controller

**Files:**
- Create: `src/enforcer.ts`
- Create: `src/enforcer.test.ts`

**Interfaces:**
- Consumes: `computeFitScale()` from `src/tableMath.ts`; `readConfig()` and `getConfiguredTableBounds()` from `src/state.ts` in the production adapter.
- Produces: `ZoomEnvironment`, `enforceZoomOnce(env)`, and `ZoomEnforcer` with `start()` / `stop()`.

- [ ] **Step 1: Write failing single-tick enforcement tests using a fake environment**

`src/enforcer.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { enforceZoomOnce, type ZoomEnvironment } from "./enforcer";

function fakeEnvironment(overrides: Partial<ZoomEnvironment> = {}): ZoomEnvironment {
  return {
    getConfig: vi.fn().mockResolvedValue({ tableItemId: "map-1", enabled: true }),
    getTableBounds: vi.fn().mockResolvedValue({
      min: { x: 0, y: 0 },
      max: { x: 1600, y: 900 },
      width: 1600,
      height: 900,
      center: { x: 800, y: 450 },
    }),
    getViewportWidth: vi.fn().mockResolvedValue(800),
    getViewportHeight: vi.fn().mockResolvedValue(450),
    getScale: vi.fn().mockResolvedValue(0.25),
    setScale: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("enforceZoomOnce", () => {
  it("raises scale when the user zooms farther out than fit", async () => {
    const env = fakeEnvironment();
    await enforceZoomOnce(env);
    expect(env.setScale).toHaveBeenCalledWith(0.5);
  });

  it("does not interfere with zooming in", async () => {
    const env = fakeEnvironment({
      getScale: vi.fn().mockResolvedValue(1.25),
    });
    await enforceZoomOnce(env);
    expect(env.setScale).not.toHaveBeenCalled();
  });

  it("does nothing when locking is disabled", async () => {
    const env = fakeEnvironment({
      getConfig: vi.fn().mockResolvedValue({ tableItemId: "map-1", enabled: false }),
    });
    await enforceZoomOnce(env);
    expect(env.setScale).not.toHaveBeenCalled();
  });

  it("does nothing when no table is configured", async () => {
    const env = fakeEnvironment({
      getConfig: vi.fn().mockResolvedValue({ tableItemId: null, enabled: true }),
    });
    await enforceZoomOnce(env);
    expect(env.setScale).not.toHaveBeenCalled();
  });

  it("does nothing when the configured item is missing", async () => {
    const env = fakeEnvironment({
      getTableBounds: vi.fn().mockResolvedValue(null),
    });
    await enforceZoomOnce(env);
    expect(env.setScale).not.toHaveBeenCalled();
  });

  it("swallows a transient SDK read failure for this tick", async () => {
    const env = fakeEnvironment({
      getScale: vi.fn().mockRejectedValue(new Error("temporary")),
    });
    await expect(enforceZoomOnce(env)).resolves.toBeUndefined();
    expect(env.setScale).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/enforcer.test.ts
```

Expected: FAIL because `enforceZoomOnce` and `ZoomEnvironment` are not implemented.

- [ ] **Step 3: Implement one-tick enforcement plus timer lifecycle**

`src/enforcer.ts`:

```ts
import OBR, { type BoundingBox } from "@owlbear-rodeo/sdk";
import { POLL_INTERVAL_MS, SCALE_EPSILON } from "./constants";
import { getConfiguredTableBounds, readConfig, type TableLockConfig } from "./state";
import { computeFitScale } from "./tableMath";

export interface ZoomEnvironment {
  getConfig(): Promise<TableLockConfig>;
  getTableBounds(config: TableLockConfig): Promise<BoundingBox | null>;
  getViewportWidth(): Promise<number>;
  getViewportHeight(): Promise<number>;
  getScale(): Promise<number>;
  setScale(scale: number): Promise<void>;
}

export const owlbearZoomEnvironment: ZoomEnvironment = {
  getConfig: readConfig,
  getTableBounds: getConfiguredTableBounds,
  getViewportWidth: () => OBR.viewport.getWidth(),
  getViewportHeight: () => OBR.viewport.getHeight(),
  getScale: () => OBR.viewport.getScale(),
  setScale: (scale) => OBR.viewport.setScale(scale),
};

export async function enforceZoomOnce(env: ZoomEnvironment): Promise<void> {
  try {
    const config = await env.getConfig();
    if (!config.enabled || !config.tableItemId) return;

    const bounds = await env.getTableBounds(config);
    if (!bounds) return;

    const [viewportWidth, viewportHeight, currentScale] = await Promise.all([
      env.getViewportWidth(),
      env.getViewportHeight(),
      env.getScale(),
    ]);

    const minimumScale = computeFitScale(
      bounds.width,
      bounds.height,
      viewportWidth,
      viewportHeight,
    );

    if (currentScale + SCALE_EPSILON < minimumScale) {
      await env.setScale(minimumScale);
    }
  } catch {
    // A transient SDK failure must not cause an unpredictable camera move.
  }
}

export class ZoomEnforcer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickInFlight = false;

  constructor(private readonly env: ZoomEnvironment = owlbearZoomEnvironment) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.tickInFlight) return;
      this.tickInFlight = true;
      void enforceZoomOnce(this.env).finally(() => {
        this.tickInFlight = false;
      });
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.tickInFlight = false;
  }
}
```

- [ ] **Step 4: Run enforcement tests**

Run:

```bash
npm test -- src/enforcer.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Run the complete automated suite and type-check**

Run:

```bash
npm test && npx tsc --noEmit
```

Expected: all tests PASS and TypeScript reports no errors.

- [ ] **Step 6: Commit the zoom controller**

```bash
git add src/enforcer.ts src/enforcer.test.ts
git commit -m "feat: clamp local viewport zoom to table bounds"
```

---

### Task 4: Add the Owlbear Action UI, GM Controls, and Fit Table

**Files:**
- Create: `src/main.ts`
- Create: `src/style.css`
- Modify: `src/state.ts`

**Interfaces:**
- Consumes: `ZoomEnforcer`, scene metadata helpers, `OBR.player.getRole`, `OBR.player.getSelection`, `OBR.scene.items.getItemBounds`, `OBR.viewport.animateToBounds`, `OBR.scene.onReadyChange`, and `OBR.scene.onMetadataChange`.
- Produces: the complete Table Lock action popover and runtime lifecycle.

- [ ] **Step 1: Add a helper that validates and stores the GM's current single selection**

Add to `src/state.ts`:

```ts
export async function setCurrentSelectionAsTable(): Promise<string> {
  const selection = await OBR.player.getSelection();
  if (!selection || selection.length !== 1) {
    throw new Error("Select exactly one scene item first.");
  }

  const items = await OBR.scene.items.getItems(selection);
  if (items.length !== 1) {
    throw new Error("Selected item is no longer available.");
  }

  const bounds = await OBR.scene.items.getItemBounds(selection);
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new Error("Selected item has invalid bounds.");
  }

  await writeTableItemId(selection[0]);
  return selection[0];
}

export async function fitConfiguredTable(): Promise<boolean> {
  const config = await readConfig();
  const bounds = await getConfiguredTableBounds(config);
  if (!bounds) return false;
  await OBR.viewport.animateToBounds(bounds);
  return true;
}
```

- [ ] **Step 2: Build the popover markup and state rendering**

`src/main.ts`:

```ts
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { ZoomEnforcer } from "./enforcer";
import {
  clearTableItemId,
  fitConfiguredTable,
  getConfiguredTableBounds,
  readConfig,
  setCurrentSelectionAsTable,
  writeEnabled,
} from "./state";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <section class="panel">
    <div class="status-row">
      <strong>Table Lock</strong>
      <span id="status" class="badge">Loading…</span>
    </div>
    <p id="table-status" class="muted">Checking scene…</p>
    <div class="actions">
      <button id="fit-table" type="button">Fit Table</button>
      <div id="gm-controls" hidden>
        <button id="set-table" type="button">Set Selected as Table</button>
        <label class="toggle-row">
          <input id="enable-lock" type="checkbox" />
          <span>Enable Table Lock</span>
        </label>
        <button id="clear-table" type="button" class="secondary">Clear Table</button>
      </div>
    </div>
    <p id="message" class="message" aria-live="polite"></p>
    <p class="muted">Pan clamping will be added after zoom clamping is verified.</p>
  </section>
`;

const status = document.querySelector<HTMLElement>("#status")!;
const tableStatus = document.querySelector<HTMLElement>("#table-status")!;
const message = document.querySelector<HTMLElement>("#message")!;
const gmControls = document.querySelector<HTMLElement>("#gm-controls")!;
const fitButton = document.querySelector<HTMLButtonElement>("#fit-table")!;
const setButton = document.querySelector<HTMLButtonElement>("#set-table")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-table")!;
const enableInput = document.querySelector<HTMLInputElement>("#enable-lock")!;

const enforcer = new ZoomEnforcer();
let isGm = false;

function setMessage(text: string): void {
  message.textContent = text;
}

async function render(): Promise<void> {
  const ready = await OBR.scene.isReady();
  if (!ready) {
    status.textContent = "No scene";
    tableStatus.textContent = "Open a scene to configure Table Lock.";
    fitButton.disabled = true;
    gmControls.hidden = !isGm;
    return;
  }

  const config = await readConfig();
  const bounds = await getConfiguredTableBounds(config);
  const hasTable = bounds !== null;

  status.textContent = config.enabled && hasTable ? "Locked" : "Unlocked";
  tableStatus.textContent = hasTable
    ? "A table boundary is configured for this scene."
    : config.tableItemId
      ? "Table object missing. Choose a new table."
      : "No table boundary configured.";
  fitButton.disabled = !hasTable;
  gmControls.hidden = !isGm;
  enableInput.checked = config.enabled;
  enableInput.disabled = !hasTable;
}

async function safeAction(action: () => Promise<void>): Promise<void> {
  setMessage("");
  try {
    await action();
    await render();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Action failed.");
  }
}

OBR.onReady(async () => {
  isGm = (await OBR.player.getRole()) === "GM";
  await render();

  const ready = await OBR.scene.isReady();
  if (ready) enforcer.start();

  OBR.scene.onReadyChange((sceneReady) => {
    if (sceneReady) enforcer.start();
    else enforcer.stop();
    void render();
  });

  OBR.scene.onMetadataChange(() => {
    void render();
  });

  OBR.player.onChange((player) => {
    isGm = player.role === "GM";
    void render();
  });

  fitButton.addEventListener("click", () => {
    void safeAction(async () => {
      if (!(await fitConfiguredTable())) throw new Error("Table object missing.");
    });
  });

  setButton.addEventListener("click", () => {
    void safeAction(async () => {
      if (!isGm) throw new Error("Only the GM can change Table Lock settings.");
      await setCurrentSelectionAsTable();
      setMessage("Selected item is now the table boundary.");
    });
  });

  enableInput.addEventListener("change", () => {
    void safeAction(async () => {
      if (!isGm) throw new Error("Only the GM can change Table Lock settings.");
      await writeEnabled(enableInput.checked);
    });
  });

  clearButton.addEventListener("click", () => {
    void safeAction(async () => {
      if (!isGm) throw new Error("Only the GM can change Table Lock settings.");
      await clearTableItemId();
      setMessage("Table boundary cleared.");
    });
  });
});
```

- [ ] **Step 3: Add compact Owlbear-friendly styling**

`src/style.css`:

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  color-scheme: light dark;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 12px;
}

.panel {
  display: grid;
  gap: 12px;
}

.status-row,
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.actions,
#gm-controls {
  display: grid;
  gap: 8px;
}

button {
  width: 100%;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid currentColor;
  cursor: pointer;
}

button:disabled {
  cursor: default;
  opacity: 0.5;
}

.secondary {
  opacity: 0.8;
}

.badge {
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.8rem;
}

.muted,
.message {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.75;
}

.message:not(:empty) {
  opacity: 1;
}
```

- [ ] **Step 4: Run all automated checks**

Run:

```bash
npm test && npm run build
```

Expected: all unit tests PASS and Vite produces `dist/` without TypeScript or build errors.

- [ ] **Step 5: Commit the functional action popover**

```bash
git add src/main.ts src/style.css src/state.ts
git commit -m "feat: add table lock controls and fit action"
```

---

### Task 5: Install Locally in Owlbear and Verify the Zoom Milestone

**Files:**
- Modify only if a defect is found: files from Tasks 1–4.

**Interfaces:**
- Consumes: built extension served by Vite and Owlbear's extension installer.
- Produces: evidence that the documented viewport scale formula and polling clamp behave correctly in a real Owlbear room before any pan-clamp work begins.

- [ ] **Step 1: Start the development server**

Run:

```bash
npm run dev -- --host 0.0.0.0
```

Expected: Vite reports a local development URL, normally `http://localhost:5173/`.

- [ ] **Step 2: Add the local manifest to Owlbear**

In Owlbear Rodeo, add a custom extension using:

```text
http://localhost:5173/manifest.json
```

Expected: **Table Lock** appears as an extension action. If the browser/Owlbear environment cannot reach localhost from the embedded frame, expose the same dev server through a temporary HTTPS tunnel and use `<tunnel-origin>/manifest.json`; do not change extension logic merely to work around transport.

- [ ] **Step 3: Configure the Astroprisma poster as the table**

Manual sequence:

```text
Open Astroprisma scene
→ select exactly one poster/background object
→ Table Lock
→ Set Selected as Table
→ Enable Table Lock
→ Fit Table
```

Expected: Fit Table frames the configured poster using Owlbear's documented `animateToBounds` behavior.

- [ ] **Step 4: Verify minimum zoom on the first viewport**

Manual checks:

```text
1. Repeatedly mouse-wheel/pinch outward.
2. Confirm the poster never becomes smaller than its fit-to-viewport scale.
3. Zoom inward well past the fit scale.
4. Confirm Table Lock does not push the view back outward.
```

Expected: zoom-out is clamped; zoom-in remains unrestricted. A very small correction within roughly one `75 ms` polling interval is acceptable; sustained oscillation or visible repeated snapping is not.

- [ ] **Step 5: Verify resize and aspect-ratio behavior**

Manual checks:

```text
1. Resize the browser to a tall/narrow shape.
2. Zoom outward until clamped.
3. Resize to a wide/short shape.
4. Zoom outward until clamped again.
```

Expected: the minimum scale changes so the whole poster remains visible at the local viewport's fit scale in both cases.

- [ ] **Step 6: Verify scene isolation**

Manual checks:

```text
1. Switch to a different scene with no Table Lock metadata.
2. Confirm zoom is unrestricted there.
3. Return to the configured scene.
4. Confirm zoom-out clamping resumes.
```

Expected: configuration is scene-specific.

- [ ] **Step 7: Verify player behavior in a second client**

Manual checks:

```text
1. Join the same room as a player in another browser/incognito session.
2. Open Table Lock and confirm GM controls are hidden.
3. Confirm Fit Table is available.
4. Confirm repeated zoom-out is clamped independently on that player's viewport.
```

Expected: the shared scene metadata defines the same table while scale is computed independently for the player's browser dimensions.

- [ ] **Step 8: Verify missing-table failure handling**

Manual checks:

```text
1. As GM, delete the configured table object from the scene.
2. Open Table Lock.
3. Attempt to zoom normally.
```

Expected: UI reports **Table object missing**, Fit Table is disabled, and the enforcer does not move the camera.

- [ ] **Step 9: Run final automated verification after any interactive fixes**

Run:

```bash
npm test && npm run build
```

Expected: all tests PASS and the production bundle builds successfully.

- [ ] **Step 10: Commit any verification-driven fixes**

```bash
git add -A
git commit -m "fix: stabilize table lock zoom behavior"
```

Skip this commit only if `git status --short` is empty.

---

## Milestone Exit Criteria

This plan is complete only when all of the following are true in a real Owlbear room:

- GM can set, enable, clear, and fit the table boundary.
- Players can fit the table but cannot modify scene-level settings.
- Repeated zoom-out cannot remain below the fit-to-table scale.
- Zoom-in remains unrestricted.
- Browser resize recalculates the effective minimum scale.
- Unconfigured scenes remain unaffected.
- Deleting the configured object disables enforcement safely.
- `npm test` and `npm run build` pass.

After these criteria pass, create a **separate bounded follow-up change** for `clampPan`; do not add pan clamping inside this milestone because the approved design explicitly gates it on successful zoom verification.
