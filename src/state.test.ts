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
