# Owlbear Rodeo Table Lock Extension — Design

## Goal

Create a small Owlbear Rodeo extension that treats a selected scene background/map as the playable tabletop boundary.

For each connected client:

- zooming in is unrestricted;
- zooming out stops when the selected background is fully framed by that client's viewport;
- optional pan clamping prevents the viewport from exposing space outside the selected background;
- a **Fit Table** action returns the camera to the selected background;
- the GM can enable/disable the lock per scene and change the bound object.

The extension should use only documented Owlbear Rodeo extension APIs.

## Key API Assumptions

The Owlbear viewport API provides methods to read and write viewport scale and position, and to read viewport width and height. It does not document a viewport-change subscription, so the first implementation will use lightweight polling while a scene is ready.

The selected table object will be stored by ID in scene metadata. Each client derives its own minimum allowed scale from the object's scene-space bounds and its own viewport dimensions, so different screen aspect ratios are handled independently.

## UX

The extension exposes one Owlbear Action popover named **Table Lock**.

GM controls:

- **Set Selected as Table** — stores the currently selected map/prop as the table boundary.
- **Enable Table Lock** — scene-level on/off toggle.
- **Clamp Panning** — optional scene-level toggle.
- **Fit Table** — frames the table object immediately.
- **Clear Table** — removes the configured boundary.

Player view:

- **Fit Table** button.
- Read-only status showing whether Table Lock and pan clamping are active.

If no table is configured, the extension does nothing.

## Bounds and Zoom Calculation

Let the table bounds in scene coordinates be `(left, top, right, bottom)` with width `Tw` and height `Th`.

Let the local viewport dimensions be `Vw` and `Vh`.

The fit-to-table scale is derived from the relationship between scene units and viewport pixels. The exact scale formula will be verified against Owlbear's viewport coordinate conversion during implementation; the extension will avoid assuming undocumented scale semantics beyond the documented 1:1 definition.

The minimum zoom-out scale is the scale at which the whole table fits in the viewport without cropping. Users may use any larger scale (zoom further in).

## Pan Clamping

When enabled, the extension computes the visible scene-space rectangle for the current viewport and current scale.

The viewport center/position is clamped so that the visible rectangle remains within the table bounds whenever the viewport is smaller than the table on that axis.

If the viewport at the minimum scale is larger than the table on one axis because of aspect-ratio mismatch, that axis is centered on the table rather than oscillating between impossible constraints.

## Enforcement Loop

Because the current documented viewport API has no change event, the extension runs a local polling loop while:

- Owlbear is ready;
- a scene is open;
- Table Lock is enabled;
- a valid table object exists.

Initial target interval: 50–100 ms. The implementation will begin conservatively and measure whether camera correction feels responsive without visible jitter.

Each tick:

1. Read current viewport dimensions, scale, and position.
2. Read or use cached table bounds.
3. Recompute the local minimum scale when viewport dimensions change.
4. Correct scale only if it is below the minimum.
5. If pan clamping is enabled, correct position only when it violates bounds.
6. Avoid calling setters when the current value is already valid.

## Metadata

Use namespaced scene metadata keys, e.g.:

- `com.astroprisma.table-lock/tableItemId`
- `com.astroprisma.table-lock/enabled`
- `com.astroprisma.table-lock/clampPan`

No user campaign content is stored by the extension.

## Failure Handling

- Configured object deleted: disable enforcement locally and show **Table object missing**.
- Scene changed: stop using old cached bounds and load new scene metadata.
- Invalid/zero-sized object: refuse to configure it.
- Temporary API errors: skip that polling tick rather than moving the camera unpredictably.
- Non-GM player: cannot change scene-level configuration.

## Implementation Shape

Small TypeScript/Vite Owlbear extension:

- `src/main.ts` — Owlbear initialization and enforcement loop.
- `src/tableBounds.ts` — bound extraction and clamp math.
- `src/state.ts` — scene metadata helpers.
- `src/ui/` — compact Action popover.
- tests for pure zoom/pan clamp math.

The first milestone implements **zoom-out clamping + Fit Table only**. Pan clamping is added after the zoom behavior is verified interactively in Owlbear, reducing the risk of building two camera behaviors before confirming Owlbear's exact coordinate semantics.

## Verification

1. Configure a rectangular map as the table.
2. Test on at least two viewport aspect ratios.
3. Mouse-wheel/pinch zoom out repeatedly; background must never become smaller than the fitted boundary.
4. Zoom in must remain unrestricted.
5. Resize browser window; minimum scale must update.
6. Switch scenes; only configured scenes should clamp.
7. Join as a player; local camera should clamp independently while configuration remains GM-only.
8. After zoom milestone passes, enable pan clamp and verify all four edges plus extreme aspect ratios.
