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

export interface ScreenBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ScreenCorrection {
  x: number;
  y: number;
}

export function computeScreenPanCorrection(
  table: ScreenBounds,
  viewportWidth: number,
  viewportHeight: number,
): ScreenCorrection {
  if (!isPositiveFinite(viewportWidth) || !isPositiveFinite(viewportHeight)) {
    throw new Error("Viewport dimensions must be positive finite values");
  }

  const tableWidth = table.maxX - table.minX;
  const tableHeight = table.maxY - table.minY;
  if (!isPositiveFinite(tableWidth) || !isPositiveFinite(tableHeight)) {
    throw new Error("Screen bounds must have positive finite dimensions");
  }

  const correctionForAxis = (
    min: number,
    max: number,
    viewportSize: number,
  ): number => {
    const size = max - min;
    if (size <= viewportSize) {
      return viewportSize / 2 - (min + max) / 2;
    }
    if (min > 0) return -min;
    if (max < viewportSize) return viewportSize - max;
    return 0;
  };

  return {
    x: correctionForAxis(table.minX, table.maxX, viewportWidth),
    y: correctionForAxis(table.minY, table.maxY, viewportHeight),
  };
}
