import { describe, expect, it } from "vitest";
import { ENABLED_KEY, TABLE_BOUNDS_KEY, TABLE_ITEM_ID_KEY } from "./constants";
import { getConfiguredTableBounds, normalizeConfig, type TableLockConfig } from "./state";

describe("normalizeConfig", () => {
  it("returns safe defaults for an empty metadata object", () => {
    expect(normalizeConfig({})).toEqual({
      tableItemId: null,
      tableBounds: null,
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
      tableBounds: null,
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
      tableBounds: null,
      enabled: false,
    });
  });

  it("reads valid tableBounds metadata", () => {
    expect(
      normalizeConfig({
        [TABLE_BOUNDS_KEY]: { min: { x: 0, y: 0 }, max: { x: 100, y: 50 } },
      }),
    ).toEqual({
      tableItemId: null,
      tableBounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 50 } },
      enabled: false,
    });
  });

  it("ignores malformed tableBounds metadata", () => {
    expect(
      normalizeConfig({
        [TABLE_BOUNDS_KEY]: { min: { x: 0, y: 0 } },
      }),
    ).toEqual({
      tableItemId: null,
      tableBounds: null,
      enabled: false,
    });
  });

  it("ignores tableBounds with non-positive size", () => {
    expect(
      normalizeConfig({
        [TABLE_BOUNDS_KEY]: { min: { x: 10, y: 10 }, max: { x: 10, y: 20 } },
      }),
    ).toEqual({
      tableItemId: null,
      tableBounds: null,
      enabled: false,
    });
  });
});

describe("getConfiguredTableBounds", () => {
  it("computes bounds directly from tableBounds when no item is configured", async () => {
    const config: TableLockConfig = {
      tableItemId: null,
      tableBounds: { min: { x: 0, y: 0 }, max: { x: 200, y: 100 } },
      enabled: true,
    };

    await expect(getConfiguredTableBounds(config)).resolves.toEqual({
      min: { x: 0, y: 0 },
      max: { x: 200, y: 100 },
      width: 200,
      height: 100,
      center: { x: 100, y: 50 },
    });
  });

  it("returns null when neither a table item nor table bounds are configured", async () => {
    const config: TableLockConfig = { tableItemId: null, tableBounds: null, enabled: false };

    await expect(getConfiguredTableBounds(config)).resolves.toBeNull();
  });
});
