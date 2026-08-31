import OBR from "@owlbear-rodeo/sdk";
import { ZoomEnforcer } from "./enforcer";
import { getConfiguredTableBounds, readConfig } from "./state";

const enforcer = new ZoomEnforcer();

async function fitLockedTableOnLoad(): Promise<void> {
  try {
    const config = await readConfig();
    if (!config.enabled) return;

    const bounds = await getConfiguredTableBounds(config);
    if (!bounds) return;

    await OBR.viewport.animateToBounds(bounds);
  } catch {
    // A failed read here just skips the initial framing; the enforcement
    // loop still clamps the view into bounds once it starts.
  }
}

async function handleSceneReady(ready: boolean): Promise<void> {
  if (!ready) {
    enforcer.stop();
    return;
  }

  await fitLockedTableOnLoad();
  enforcer.start();
}

OBR.onReady(async () => {
  await handleSceneReady(await OBR.scene.isReady());

  OBR.scene.onReadyChange((ready: boolean) => {
    void handleSceneReady(ready);
  });
});
