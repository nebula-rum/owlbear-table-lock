import OBR from "@owlbear-rodeo/sdk";
import { ZoomEnforcer } from "./enforcer";

const enforcer = new ZoomEnforcer();

OBR.onReady(async () => {
  const syncWithScene = async (): Promise<void> => {
    if (await OBR.scene.isReady()) enforcer.start();
    else enforcer.stop();
  };

  await syncWithScene();

  OBR.scene.onReadyChange((ready: boolean) => {
    if (ready) enforcer.start();
    else enforcer.stop();
  });
});
