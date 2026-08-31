import { describe, expect, it } from "vitest";
import { computeFitScale, computeScreenPanCorrection, isPositiveFinite } from "./tableMath";

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


describe("computeScreenPanCorrection", () => {
  it("pushes the table left when blank space appears on the left", () => {
    expect(
      computeScreenPanCorrection(
        { minX: 100, minY: 0, maxX: 1700, maxY: 900 },
        1600,
        900,
      ),
    ).toEqual({ x: -100, y: 0 });
  });

  it("pushes the table right when blank space appears on the right", () => {
    expect(
      computeScreenPanCorrection(
        { minX: -100, minY: 0, maxX: 1500, maxY: 900 },
        1600,
        900,
      ),
    ).toEqual({ x: 100, y: 0 });
  });

  it("clamps vertical panning too", () => {
    expect(
      computeScreenPanCorrection(
        { minX: 0, minY: 75, maxX: 1600, maxY: 975 },
        1600,
        900,
      ),
    ).toEqual({ x: 0, y: -75 });
  });

  it("does not move a viewport already contained by the table", () => {
    expect(
      computeScreenPanCorrection(
        { minX: -200, minY: -100, maxX: 1800, maxY: 1000 },
        1600,
        900,
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it("centers an axis when the table is smaller than the viewport on that axis", () => {
    expect(
      computeScreenPanCorrection(
        { minX: 300, minY: 0, maxX: 1300, maxY: 900 },
        1600,
        900,
      ),
    ).toEqual({ x: 0, y: 0 });

    expect(
      computeScreenPanCorrection(
        { minX: 400, minY: 0, maxX: 1400, maxY: 900 },
        1600,
        900,
      ),
    ).toEqual({ x: -100, y: 0 });
  });
});
