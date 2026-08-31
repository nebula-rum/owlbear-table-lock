import OBR, { type BoundingBox, type Vector2 } from "@owlbear-rodeo/sdk";
import { SCALE_EPSILON } from "./constants";
import { getConfiguredTableBounds, readConfig, type TableLockConfig } from "./state";
import { computeFitScale, computeScreenPanCorrection } from "./tableMath";

export interface ZoomEnvironment {
  getConfig(): Promise<TableLockConfig>;
  getTableBounds(config: TableLockConfig): Promise<BoundingBox | null>;
  getViewportWidth(): Promise<number>;
  getViewportHeight(): Promise<number>;
  getScale(): Promise<number>;
  setScale(scale: number): Promise<void>;
  getPosition(): Promise<Vector2>;
  setPosition(position: Vector2): Promise<void>;
  transformPoint(point: Vector2): Promise<Vector2>;
}

export const owlbearZoomEnvironment: ZoomEnvironment = {
  getConfig: readConfig,
  getTableBounds: getConfiguredTableBounds,
  getViewportWidth: () => OBR.viewport.getWidth(),
  getViewportHeight: () => OBR.viewport.getHeight(),
  getScale: () => OBR.viewport.getScale(),
  setScale: (scale) => OBR.viewport.setScale(scale),
  getPosition: () => OBR.viewport.getPosition(),
  setPosition: (position) => OBR.viewport.setPosition(position),
  transformPoint: (point) => OBR.viewport.transformPoint(point),
};

export async function enforceZoomOnce(env: ZoomEnvironment): Promise<void> {
  try {
    const config = await env.getConfig();
    if (!config.enabled || (!config.tableItemId && !config.tableBounds)) return;

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
      return;
    }

    const [screenA, screenB, currentPosition] = await Promise.all([
      env.transformPoint(bounds.min),
      env.transformPoint(bounds.max),
      env.getPosition(),
    ]);

    const correction = computeScreenPanCorrection(
      {
        minX: Math.min(screenA.x, screenB.x),
        minY: Math.min(screenA.y, screenB.y),
        maxX: Math.max(screenA.x, screenB.x),
        maxY: Math.max(screenA.y, screenB.y),
      },
      viewportWidth,
      viewportHeight,
    );

    if (Math.abs(correction.x) > 0.5 || Math.abs(correction.y) > 0.5) {
      await env.setPosition({
        x: currentPosition.x + correction.x,
        y: currentPosition.y + correction.y,
      });
    }
  } catch {
    // Skip transient SDK failures. A failed read must never cause a camera move.
  }
}

export type SetTimer = (callback: () => void, intervalMs: number) => number;
export type ClearTimer = (handle: number) => void;

const ENFORCEMENT_INTERVAL_MS = 16;

export class ZoomEnforcer {
  private timerHandle: number | null = null;
  private tickInFlight = false;
  private running = false;

  constructor(
    private readonly env: ZoomEnvironment = owlbearZoomEnvironment,
    private readonly setTimer: SetTimer = (callback, intervalMs) =>
      window.setInterval(callback, intervalMs),
    private readonly clearTimer: ClearTimer = (handle) => window.clearInterval(handle),
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    const tick = (): void => {
      if (!this.running || this.tickInFlight) return;

      this.tickInFlight = true;
      void enforceZoomOnce(this.env).finally(() => {
        this.tickInFlight = false;
      });
    };

    this.timerHandle = this.setTimer(tick, ENFORCEMENT_INTERVAL_MS);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.timerHandle !== null) {
      this.clearTimer(this.timerHandle);
      this.timerHandle = null;
    }
    this.tickInFlight = false;
  }
}
