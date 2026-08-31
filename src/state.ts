import OBR, { type BoundingBox, type Metadata, type Vector2 } from "@owlbear-rodeo/sdk";
import { ENABLED_KEY, TABLE_BOUNDS_KEY, TABLE_ITEM_ID_KEY } from "./constants";

export interface TableBounds {
  min: Vector2;
  max: Vector2;
}

export interface TableLockConfig {
  tableItemId: string | null;
  tableBounds: TableBounds | null;
  enabled: boolean;
}

function isFiniteVector2(value: unknown): value is Vector2 {
  if (typeof value !== "object" || value === null) return false;
  const { x, y } = value as Vector2;
  return Number.isFinite(x) && Number.isFinite(y);
}

function normalizeTableBounds(value: unknown): TableBounds | null {
  if (typeof value !== "object" || value === null) return null;
  const { min, max } = value as { min?: unknown; max?: unknown };
  if (!isFiniteVector2(min) || !isFiniteVector2(max)) return null;
  if (max.x <= min.x || max.y <= min.y) return null;
  return { min, max };
}

export function normalizeConfig(metadata: Metadata): TableLockConfig {
  const rawId = metadata[TABLE_ITEM_ID_KEY];
  const rawEnabled = metadata[ENABLED_KEY];

  return {
    tableItemId: typeof rawId === "string" && rawId.length > 0 ? rawId : null,
    tableBounds: normalizeTableBounds(metadata[TABLE_BOUNDS_KEY]),
    enabled: typeof rawEnabled === "boolean" ? rawEnabled : false,
  };
}

export async function readConfig(): Promise<TableLockConfig> {
  return normalizeConfig(await OBR.scene.getMetadata());
}

export async function writeTableItemId(id: string): Promise<void> {
  await OBR.scene.setMetadata({ [TABLE_ITEM_ID_KEY]: id, [TABLE_BOUNDS_KEY]: null });
}

export async function writeTableBounds(bounds: TableBounds): Promise<void> {
  await OBR.scene.setMetadata({ [TABLE_ITEM_ID_KEY]: null, [TABLE_BOUNDS_KEY]: bounds });
}

export async function clearTable(): Promise<void> {
  await OBR.scene.setMetadata({
    [TABLE_ITEM_ID_KEY]: null,
    [TABLE_BOUNDS_KEY]: null,
    [ENABLED_KEY]: false,
  });
}

export async function writeEnabled(enabled: boolean): Promise<void> {
  await OBR.scene.setMetadata({ [ENABLED_KEY]: enabled });
}

export async function getConfiguredTableBounds(
  config: TableLockConfig,
): Promise<BoundingBox | null> {
  if (config.tableItemId) {
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

  if (config.tableBounds) {
    const { min, max } = config.tableBounds;
    const width = max.x - min.x;
    const height = max.y - min.y;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    return { min, max, width, height, center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 } };
  }

  return null;
}

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

export async function setCurrentViewAsTable(): Promise<TableBounds> {
  const [viewportWidth, viewportHeight] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    throw new Error("Viewport size is unavailable.");
  }

  const [corner1, corner2] = await Promise.all([
    OBR.viewport.inverseTransformPoint({ x: 0, y: 0 }),
    OBR.viewport.inverseTransformPoint({ x: viewportWidth, y: viewportHeight }),
  ]);

  const bounds: TableBounds = {
    min: { x: Math.min(corner1.x, corner2.x), y: Math.min(corner1.y, corner2.y) },
    max: { x: Math.max(corner1.x, corner2.x), y: Math.max(corner1.y, corner2.y) },
  };

  if (
    bounds.max.x <= bounds.min.x ||
    bounds.max.y <= bounds.min.y ||
    !Number.isFinite(bounds.min.x) ||
    !Number.isFinite(bounds.min.y) ||
    !Number.isFinite(bounds.max.x) ||
    !Number.isFinite(bounds.max.y)
  ) {
    throw new Error("Current view has invalid bounds.");
  }

  await writeTableBounds(bounds);
  return bounds;
}

export async function fitConfiguredTable(): Promise<boolean> {
  const config = await readConfig();
  const bounds = await getConfiguredTableBounds(config);
  if (!bounds) return false;

  await OBR.viewport.animateToBounds(bounds);
  return true;
}
