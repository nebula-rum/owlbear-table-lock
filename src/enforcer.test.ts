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
    getPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    setPosition: vi.fn().mockResolvedValue(undefined),
    transformPoint: vi.fn(async (point: { x: number; y: number }) => ({
      x: point.x * 0.5,
      y: point.y * 0.5,
    })),
    ...overrides,
  };
}

describe("enforceZoomOnce", () => {
  it("raises scale when the user zooms farther out than fit", async () => {
    const env = fakeEnvironment();
    await enforceZoomOnce(env);
    expect(env.setScale).toHaveBeenCalledWith(0.5);
    expect(env.setPosition).not.toHaveBeenCalled();
  });

  it("does not interfere with zooming in", async () => {
    const env = fakeEnvironment({
      getScale: vi.fn().mockResolvedValue(1.25),
    });
    await enforceZoomOnce(env);
    expect(env.setScale).not.toHaveBeenCalled();
  });


  it("clamps panning when the table leaves blank space on the left", async () => {
    const env = fakeEnvironment({
      getScale: vi.fn().mockResolvedValue(1),
      getPosition: vi.fn().mockResolvedValue({ x: 100, y: 0 }),
      transformPoint: vi.fn(async (point: { x: number; y: number }) => ({
        x: point.x + 100,
        y: point.y,
      })),
    });

    await enforceZoomOnce(env);

    expect(env.setPosition).toHaveBeenCalledWith({ x: 0, y: 0 });
  });

  it("does not interfere with legal panning while zoomed in", async () => {
    const env = fakeEnvironment({
      getScale: vi.fn().mockResolvedValue(1),
      getPosition: vi.fn().mockResolvedValue({ x: -100, y: -50 }),
      transformPoint: vi.fn(async (point: { x: number; y: number }) => ({
        x: point.x - 100,
        y: point.y - 50,
      })),
    });

    await enforceZoomOnce(env);

    expect(env.setPosition).not.toHaveBeenCalled();
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
      getConfig: vi.fn().mockResolvedValue({ tableItemId: null, tableBounds: null, enabled: true }),
    });
    await enforceZoomOnce(env);
    expect(env.setScale).not.toHaveBeenCalled();
  });

  it("enforces zoom and pan when the table is a captured view instead of a tracked item", async () => {
    const env = fakeEnvironment({
      getConfig: vi.fn().mockResolvedValue({
        tableItemId: null,
        tableBounds: { min: { x: 0, y: 0 }, max: { x: 1600, y: 900 } },
        enabled: true,
      }),
    });
    await enforceZoomOnce(env);
    expect(env.setScale).toHaveBeenCalledWith(0.5);
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

import { ZoomEnforcer } from "./enforcer";

describe("ZoomEnforcer scheduling", () => {
  it("uses a 16 ms interval so enforcement continues in a hidden background iframe", () => {
    const env = fakeEnvironment({ getScale: vi.fn().mockResolvedValue(1) });
    const setTimer = vi.fn(() => 42);
    const clearTimer = vi.fn();

    const enforcer = new ZoomEnforcer(env, setTimer, clearTimer);
    enforcer.start();

    expect(setTimer).toHaveBeenCalledTimes(1);
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 16);
  });

  it("clears the polling interval when stopped", () => {
    const env = fakeEnvironment();
    const setTimer = vi.fn(() => 73);
    const clearTimer = vi.fn();

    const enforcer = new ZoomEnforcer(env, setTimer, clearTimer);
    enforcer.start();
    enforcer.stop();

    expect(clearTimer).toHaveBeenCalledWith(73);
  });

  it("does not start a second interval when already running", () => {
    const env = fakeEnvironment();
    const setTimer = vi.fn(() => 91);
    const clearTimer = vi.fn();

    const enforcer = new ZoomEnforcer(env, setTimer, clearTimer);
    enforcer.start();
    enforcer.start();

    expect(setTimer).toHaveBeenCalledTimes(1);
  });
});
