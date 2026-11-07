// Routes only. The real work lives in ai/, import/ and voice/.
import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type {
  AnswerRequest,
  ApiError,
  ChatEvent,
  ChatRequest,
  CreateQuizRequest,
  Health,
  Quiz,
  SpeakRequest,
  TranscribeResponse,
} from "../../shared/types";
import { AI_IS_PLACEHOLDER, chat, DIFFICULTIES, generateQuestions, markAnswer } from "./ai/index";
import { currentActivity, modelStatuses, setActivity, warmUp } from "./ai/models";
import { ensureIndexed, removeFromIndex } from "./ai/rag";
import { IMPORT_IS_PLACEHOLDER, importFile } from "./import/index";
import { store } from "./store";
import { speak, transcribe, VOICE_IS_PLACEHOLDER } from "./voice/index";

// Local only: this address can't be reached from other devices.
const HOST = "127.0.0.1";
const PORT = 3001;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const WEB_PORT = 5173;
const DEFAULT_QUESTIONS = 5;
const MAX_QUESTIONS = 20;
const LOCAL_HOSTS = ["127.0.0.1", "localhost"].flatMap((host) => [
  `${host}:${PORT}`,
  `${host}:${WEB_PORT}`,
]);

class BadRequest extends Error {}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

// Listening on 127.0.0.1 doesn't stop a website open in the student's browser from
// calling this server, so only accept requests that come from this app.
app.use((req, res, next) => {
  const origin = req.get("origin");
  const allowed =
    LOCAL_HOSTS.includes(req.get("host") ?? "") &&
    (!origin || LOCAL_HOSTS.some((host) => origin === `http://${host}`));
  if (allowed) {
    next();
    return;
  }
  const body: ApiError = { error: "Requests from other sites aren't allowed." };
  res.status(403).json(body);
});

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  const health: Health = {
    ok: true,
    placeholders: {
      ai: AI_IS_PLACEHOLDER,
      import: IMPORT_IS_PLACEHOLDER,
      voice: VOICE_IS_PLACEHOLDER,
    },
    models: modelStatuses(),
    activity: currentActivity(),
  };
  res.json(health);
});

app.get("/api/documents", (_req, res) => {
  res.json(store.listDocuments());
});

app.post("/api/documents", upload.single("file"), async (req, res) => {
  if (!req.file) throw new BadRequest("No file was uploaded.");
  // multer decodes file names as latin1, so restore UTF-8 names.
  const name = Buffer.from(req.file.originalname, "latin1").toString("utf8");
  setActivity(`Reading ${name}`);
  let document;
  try {
    document = await importFile({ name, mimeType: req.file.mimetype, bytes: req.file.buffer });
  } finally {
    setActivity(null);
  }
  store.addDocument(document);
  // The text is safe even if indexing fails. Chat tries again on the next question.
  await ensureIndexed([document]).catch((error) => console.error(error));
  res.status(201).json(document);
});

app.delete("/api/documents/:id", (req, res) => {
  store.removeDocument(req.params.id);
  removeFromIndex(req.params.id);
  res.status(204).end();
});

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body as ChatRequest;
  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      (m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string",
    ) &&
    messages[messages.length - 1].role === "user" &&
    messages[messages.length - 1].content.trim() !== "";
  if (!valid) throw new BadRequest("Ask a question first.");

  res.type("application/x-ndjson");
  res.flushHeaders();
  const send = (event: ChatEvent) => res.write(`${JSON.stringify(event)}\n`);
  const stopped = new AbortController();
  res.on("close", () => stopped.abort());
  try {
    await ensureIndexed(store.listDocuments());
    await chat(messages, send, stopped.signal);
    send({ type: "done" });
  } catch (error) {
    console.error(error);
    send({ type: "error", error: error instanceof Error ? error.message : "Something went wrong." });
  }
  res.end();
});

app.post("/api/quizzes", async (req, res) => {
  const { documentIds, count, difficulty = "medium" } = req.body as CreateQuizRequest;
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new BadRequest("Choose easy, medium or hard.");
  }
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    throw new BadRequest("Choose at least one document.");
  }
  const documents = documentIds.map((id) => {
    const document = store.getDocument(id);
    if (!document) throw new BadRequest(`Unknown document: ${id}`);
    return document;
  });
  const quiz: Quiz = {
    id: randomUUID(),
    documentIds,
    questions: await generateQuestions(
      documents,
      Math.max(1, Math.min(Number(count) || DEFAULT_QUESTIONS, MAX_QUESTIONS)),
      difficulty,
    ),
    createdAt: new Date().toISOString(),
  };
  store.addQuiz(quiz);
  res.status(201).json(quiz);
});

app.post("/api/quizzes/:quizId/questions/:questionId/answer", async (req, res) => {
  const question = store
    .getQuiz(req.params.quizId)
    ?.questions.find((q) => q.id === req.params.questionId);
  if (!question) throw new BadRequest("Unknown question.");
  const { answer } = req.body as AnswerRequest;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new BadRequest("Answer is empty.");
  }
  res.json(await markAnswer(question, answer));
});

app.post("/api/voice/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) throw new BadRequest("No audio was uploaded.");
  const response: TranscribeResponse = {
    text: await transcribe(req.file.buffer, req.file.mimetype),
  };
  res.json(response);
});

app.post("/api/voice/speak", async (req, res) => {
  const { text } = req.body as SpeakRequest;
  if (typeof text !== "string" || !text.trim()) throw new BadRequest("Text is empty.");
  const audio = await speak(text);
  if (!audio) {
    throw new BadRequest("There's nothing to read aloud in that text.");
  }
  res.type(audio.mimeType).send(audio.bytes);
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Express marks malformed request bodies with status 400.
  const known =
    err instanceof BadRequest ||
    err instanceof multer.MulterError ||
    (err as { status?: number }).status === 400;
  if (!known) console.error(err);
  const body: ApiError = {
    error: err instanceof Error ? err.message : "Something went wrong.",
  };
  res.status(known ? 400 : 500).json(body);
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  void warmUp().catch((error) => console.error(error));
});
