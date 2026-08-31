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
