// Run this once while online with: npm run models
// It loads each model the same way the app does, so the app works offline afterwards.
import { close, unloadModel } from "@qvac/sdk";
import { ensureModel, MODEL_KEYS, modelStatuses } from "./ai/models";

const lastShown: Record<string, string> = {};
const timer = setInterval(() => {
  for (const model of modelStatuses()) {
    const line =
      model.state === "downloading"
        ? `downloading ${Math.floor((model.progress ?? 0) / 5) * 5}%`
        : model.state;
    if (lastShown[model.key] !== line && (model.state === "downloading" || lastShown[model.key])) {
      console.log(`${model.label}: ${line}`);
    }
    lastShown[model.key] = line;
  }
}, 500);

let failed = false;
for (const key of MODEL_KEYS) {
  try {
    await unloadModel({ modelId: await ensureModel(key) });
  } catch (error) {
    failed = true;
    console.error(error instanceof Error ? error.message : error);
  }
}
clearInterval(timer);
console.log(failed ? "Some models failed. Run this again." : "All models are ready for offline use.");
await close();
process.exit(failed ? 1 : 0);
