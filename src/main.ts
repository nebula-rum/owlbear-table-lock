import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import {
  clearTableItemId,
  fitConfiguredTable,
  getConfiguredTableBounds,
  readConfig,
  setCurrentSelectionAsTable,
  writeEnabled,
} from "./state";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <section class="panel">
    <div class="status-row">
      <strong>Table Lock</strong>
      <span id="status" class="badge">Loading…</span>
    </div>
    <p id="table-status" class="muted">Checking scene…</p>
    <div class="actions">
      <button id="fit-table" type="button">Fit Table</button>
      <div id="gm-controls" hidden>
        <button id="set-table" type="button">Set Selected as Table</button>
        <label class="toggle-row">
          <input id="enable-lock" type="checkbox" />
          <span>Enable Table Lock</span>
        </label>
        <button id="clear-table" type="button" class="secondary">Clear Table</button>
      </div>
    </div>
    <p id="message" class="message" aria-live="polite"></p>
    <p class="muted">Zoom and pan locking run continuously while this extension is enabled.</p>
  </section>
`;

const status = document.querySelector<HTMLElement>("#status")!;
const tableStatus = document.querySelector<HTMLElement>("#table-status")!;
const message = document.querySelector<HTMLElement>("#message")!;
const gmControls = document.querySelector<HTMLElement>("#gm-controls")!;
const fitButton = document.querySelector<HTMLButtonElement>("#fit-table")!;
const setButton = document.querySelector<HTMLButtonElement>("#set-table")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-table")!;
const enableInput = document.querySelector<HTMLInputElement>("#enable-lock")!;

let isGm = false;

function setMessage(text: string): void {
  message.textContent = text;
}

async function render(): Promise<void> {
  try {
    const ready = await OBR.scene.isReady();
    if (!ready) {
      status.textContent = "No scene";
      tableStatus.textContent = "Open a scene to configure Table Lock.";
      fitButton.disabled = true;
      gmControls.hidden = !isGm;
      return;
    }

    const config = await readConfig();
    const bounds = await getConfiguredTableBounds(config);
    const hasTable = bounds !== null;

    status.textContent = config.enabled && hasTable ? "Locked" : "Unlocked";
    tableStatus.textContent = hasTable
      ? "A table boundary is configured for this scene."
      : config.tableItemId
        ? "Table object missing. Choose a new table."
        : "No table boundary configured.";
    fitButton.disabled = !hasTable;
    gmControls.hidden = !isGm;
    enableInput.checked = config.enabled;
    enableInput.disabled = !hasTable;
  } catch {
    status.textContent = "Unavailable";
    tableStatus.textContent = "Could not read the current scene.";
    fitButton.disabled = true;
  }
}

async function safeAction(action: () => Promise<void>): Promise<void> {
  setMessage("");
  try {
    await action();
    await render();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Action failed.");
  }
}

OBR.onReady(async () => {
  isGm = (await OBR.player.getRole()) === "GM";
  await render();

  OBR.scene.onReadyChange(() => {
    void render();
  });

  OBR.scene.onMetadataChange(() => {
    void render();
  });

  OBR.scene.items.onChange(() => {
    void render();
  });

  OBR.player.onChange((player: { role: "GM" | "PLAYER" }) => {
    isGm = player.role === "GM";
    void render();
  });

  fitButton.addEventListener("click", () => {
    void safeAction(async () => {
      if (!(await fitConfiguredTable())) throw new Error("Table object missing.");
    });
  });

  setButton.addEventListener("click", () => {
    void safeAction(async () => {
      if (!isGm) throw new Error("Only the GM can change Table Lock settings.");
      await setCurrentSelectionAsTable();
      setMessage("Selected item is now the table boundary.");
    });
  });

  enableInput.addEventListener("change", () => {
    void safeAction(async () => {
      if (!isGm) throw new Error("Only the GM can change Table Lock settings.");
      await writeEnabled(enableInput.checked);
    });
  });

  clearButton.addEventListener("click", () => {
    void safeAction(async () => {
      if (!isGm) throw new Error("Only the GM can change Table Lock settings.");
      await clearTableItemId();
      setMessage("Table boundary cleared.");
    });
  });
});
