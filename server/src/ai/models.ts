// The one place that loads QVAC models. Each model loads once, on first use,
// and its progress is reported through /api/health so the app can show it.
import {
  EMBEDDINGGEMMA_300M_Q4_0,
  getModelInfo,
  loadModel,
  OCR_DOCTR,
  QWEN3_4B_INST_Q4_K_M,
  TTS_EN_SUPERTONIC_Q4_0,
  VAD_SILERO_5_1_2,
  WHISPER_EN_BASE_Q8_0,
} from "@qvac/sdk";
import type { ModelState, ModelStatus } from "../../../shared/types";

// On integrated graphics the CPU was faster: 12 vs 7 tokens a second on an
// i5-12450H. Set LLM_DEVICE=gpu on a laptop with a dedicated graphics card.
const LLM_DEVICE = process.env.LLM_DEVICE === "gpu" ? "gpu" : "cpu";

const CATALOG = {
  llm: {
    label: "Qwen3 4B",
    purpose: "Chat, writing questions and marking",
    load: () =>
      loadWith(QWEN3_4B_INST_Q4_K_M, "llm", { ctx_size: 4096, device: LLM_DEVICE }),
    descriptor: QWEN3_4B_INST_Q4_K_M,
  },
  embeddings: {
    label: "EmbeddingGemma",
    purpose: "Searching your notes",
    load: () => loadWith(EMBEDDINGGEMMA_300M_Q4_0, "embeddings", { device: "cpu" }),
    descriptor: EMBEDDINGGEMMA_300M_Q4_0,
  },
  stt: {
    label: "Whisper Base (English)",
    purpose: "Understanding your voice",
    load: () =>
      loadWith(WHISPER_EN_BASE_Q8_0, "stt", {
        language: "en",
        audio_format: "s16le",
        vadModelSrc: VAD_SILERO_5_1_2,
      }),
    descriptor: WHISPER_EN_BASE_Q8_0,
  },
  tts: {
    label: "Supertonic (English)",
    purpose: "Reading text aloud",
    load: () =>
      loadWith(TTS_EN_SUPERTONIC_Q4_0, "tts", {
        ttsEngine: "supertonic",
        language: "en",
        voice: "F1",
      }),
    descriptor: TTS_EN_SUPERTONIC_Q4_0,
  },
  ocr: {
    label: "DocTR",
    purpose: "Reading scans and photos",
    load: () => loadWith(OCR_DOCTR, "ocr", undefined),
    descriptor: OCR_DOCTR,
  },
};

export type ModelKey = keyof typeof CATALOG;
export const MODEL_KEYS = Object.keys(CATALOG) as ModelKey[];

interface Tracked {
  state: ModelState;
  progress?: number;
  error?: string;
  loading?: Promise<string>;
}

const tracked = Object.fromEntries(
  MODEL_KEYS.map((key) => [key, { state: "missing" } satisfies Tracked]),
) as Record<ModelKey, Tracked>;

function loadWith(
  modelSrc: unknown,
  key: ModelKey,
  modelConfig: Record<string, unknown> | undefined,
): Promise<string> {
  // The SDK picks the right config type from each model. This table holds all
  // of them, so TypeScript can't check it here.
  return loadModel({
    modelSrc,
    modelConfig,
    onProgress: (progress: { percentage: number }) => {
      const status = tracked[key];
      if (status.state === "ready") return;
      if (progress.percentage >= 100) {
        status.state = "loading";
        status.progress = undefined;
      } else {
        status.state = "downloading";
        status.progress = progress.percentage;
      }
    },
  } as never);
}

/** Returns the model's id, loading it first if needed. */
export function ensureModel(key: ModelKey): Promise<string> {
  const status = tracked[key];
  if (status.loading) return status.loading;

  status.state = "loading";
  status.error = undefined;
  status.loading = (async () => {
    const wasOnDisk = await isOnDisk(key);
    try {
      const modelId = await CATALOG[key].load();
      status.state = "ready";
      return modelId;
    } catch (error) {
      status.loading = undefined;
      status.state = "error";
      console.error(`Couldn't load ${CATALOG[key].label}:`, error);
      status.error = wasOnDisk
        ? `Couldn't load ${CATALOG[key].label}. Close other apps to free memory, then try again.`
        : `${CATALOG[key].label} isn't on this laptop yet. Connect to the internet and run: npm run models`;
      throw new Error(status.error);
    }
  })();
  return status.loading;
}

async function isOnDisk(key: ModelKey): Promise<boolean> {
  try {
    return (await getModelInfo({ name: CATALOG[key].descriptor.name })).isCached;
  } catch {
    return false;
  }
}

/** Checks which models are on disk, then loads the two that nearly every request needs. */
export async function warmUp(): Promise<void> {
  const onDisk = await Promise.all(MODEL_KEYS.map(isOnDisk));
  MODEL_KEYS.forEach((key, index) => {
    if (onDisk[index] && tracked[key].state === "missing") tracked[key].state = "downloaded";
  });
  for (const key of ["embeddings", "llm"] as const) {
    // Never start a surprise 2.5 GB download. That waits until the student uses the app.
    if (tracked[key].state !== "downloaded") continue;
    await ensureModel(key).catch(() => undefined);
  }
}

export function modelStatuses(): ModelStatus[] {
  return MODEL_KEYS.map((key) => ({
    key,
    label: CATALOG[key].label,
    purpose: CATALOG[key].purpose,
    sizeMB: Math.round((CATALOG[key].descriptor.expectedSize ?? 0) / 1e6),
    state: tracked[key].state,
    progress: tracked[key].progress,
    error: tracked[key].error,
  }));
}

let activity: string | null = null;

export const currentActivity = () => activity;

/** Publishes what the AI is doing. Pass null when it's finished. */
export function setActivity(text: string | null): void {
  activity = text;
}

let llmQueue: Promise<unknown> = Promise.resolve();

/** Qwen3 handles one request at a time, so requests take turns. */
export function withLlm<T>(task: (modelId: string) => Promise<T>): Promise<T> {
  const run = llmQueue.then(async () => task(await ensureModel("llm")));
  llmQueue = run.catch(() => undefined);
  return run;
}
