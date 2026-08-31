import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import {
  clearTable,
  fitConfiguredTable,
  getConfiguredTableBounds,
  readConfig,
  setCurrentSelectionAsTable,
  setCurrentViewAsTable,
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
      <button id="set-table" type="button" hidden>Set Selected as Table</button>
      <button id="set-view-table" type="button" hidden>Set Current View as Table</button>
      <label id="enable-lock-row" class="toggle-row" hidden>
        <input id="enable-lock" type="checkbox" />
        <span>Enable Table Lock</span>
      </label>
      <button id="fit-table" type="button">Fit Table</button>
      <button id="clear-table" type="button" class="secondary" hidden>Clear Table</button>
    </div>
    <p id="message" class="message" aria-live="polite"></p>
    <p class="muted">Zoom and pan locking run continuously while this extension is enabled.</p>
  </section>
`;

const status = document.querySelector<HTMLElement>("#status")!;
const tableStatus = document.querySelector<HTMLElement>("#table-status")!;
const message = document.querySelector<HTMLElement>("#message")!;
const fitButton = document.querySelector<HTMLButtonElement>("#fit-table")!;
const setButton = document.querySelector<HTMLButtonElement>("#set-table")!;
const setViewButton = document.querySelector<HTMLButtonElement>("#set-view-table")!;
const enableLockRow = document.querySelector<HTMLElement>("#enable-lock-row")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-table")!;
const enableInput = document.querySelector<HTMLInputElement>("#enable-lock")!;
const gmOnlyElements = [setButton, setViewButton, enableLockRow, clearButton];

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
      for (const el of gmOnlyElements) el.hidden = !isGm;
      return;
    }

    const config = await readConfig();
    const bounds = await getConfiguredTableBounds(config);
    const hasTable = bounds !== null;

    status.textContent = config.enabled && hasTable ? "Locked" : "Unlocked";
    tableStatus.textContent = hasTable
      ? "A table boundary is configured for this scene."
      : config.tableItemId || config.tableBounds
        ? "Table boundary missing. Choose a new table."
        : "No table boundary configured.";
    fitButton.disabled = !hasTable;
    for (const el of gmOnlyElements) el.hidden = !isGm;
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

  setViewButton.addEventListener("click", () => {
    void safeAction(async () => {
      if (!isGm) throw new Error("Only the GM can change Table Lock settings.");
      await setCurrentViewAsTable();
      setMessage("Current view is now the table boundary.");
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
      await clearTable();
      setMessage("Table boundary cleared.");
    });
  });
});
