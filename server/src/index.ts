// Routes only. The real work lives in ai/, import/ and voice/.
import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type {
  AnswerRequest,
  ApiError,
  CreateQuizRequest,
  Health,
  Quiz,
  SpeakRequest,
  TranscribeResponse,
} from "../../shared/types";
import { AI_IS_PLACEHOLDER, generateQuestions, markAnswer } from "./ai/index";
import { IMPORT_IS_PLACEHOLDER, importFile } from "./import/index";
import { store } from "./store";
import { speak, transcribe, VOICE_IS_PLACEHOLDER } from "./voice/index";

// Local only: this address can't be reached from other devices.
const HOST = "127.0.0.1";
const PORT = 3001;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

class BadRequest extends Error {}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

app.use(express.json());

app.get("/api/health", (_req, res) => {
  const health: Health = {
    ok: true,
    placeholders: {
      ai: AI_IS_PLACEHOLDER,
      import: IMPORT_IS_PLACEHOLDER,
      voice: VOICE_IS_PLACEHOLDER,
    },
  };
  res.json(health);
});

app.get("/api/documents", (_req, res) => {
  res.json(store.listDocuments());
});

app.post("/api/documents", upload.single("file"), async (req, res) => {
  if (!req.file) throw new BadRequest("No file was uploaded.");
  const document = await importFile({
    // multer decodes file names as latin1, so restore UTF-8 names.
    name: Buffer.from(req.file.originalname, "latin1").toString("utf8"),
    mimeType: req.file.mimetype,
    bytes: req.file.buffer,
  });
  store.addDocument(document);
  res.status(201).json(document);
});

app.post("/api/quizzes", async (req, res) => {
  const { documentIds, count } = req.body as CreateQuizRequest;
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
    questions: await generateQuestions(documents, count || 5),
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
    const body: ApiError = { error: "Text-to-speech isn't connected yet." };
    res.status(501).json(body);
    return;
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
});
