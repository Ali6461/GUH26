// The contract between the server and the web app.
// Tell the team before changing anything here, because everyone depends on it.

export type DocumentKind = "text" | "pdf" | "slides" | "image";

export interface DocumentPage {
  /** 1-based page, slide or image number. */
  page: number;
  text: string;
}

export interface StudyDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  pages: DocumentPage[];
  /** Problems to show the user, such as "page 3 could not be read". */
  warnings: string[];
  createdAt: string;
}

/** Where a question came from, so the user can always check it. */
export interface SourceRef {
  documentId: string;
  documentName: string;
  page: number;
  /** The exact passage from the user's notes. */
  quote: string;
}

export interface Question {
  id: string;
  prompt: string;
  /** What a good answer should contain. The server marks against this. */
  expectedAnswer: string;
  source: SourceRef;
}

export interface Quiz {
  id: string;
  documentIds: string[];
  questions: Question[];
  createdAt: string;
}

export interface MarkResult {
  questionId: string;
  answer: string;
  correct: boolean;
  feedback: string;
  source: SourceRef;
}

export type ModelState =
  | "missing" // Not on this laptop yet.
  | "downloaded" // On disk, not in memory.
  | "downloading"
  | "loading"
  | "ready"
  | "error";

export interface ModelStatus {
  key: string;
  label: string;
  /** What this model does for the student. */
  purpose: string;
  sizeMB: number;
  state: ModelState;
  /** Download progress from 0 to 100, while downloading. */
  progress?: number;
  error?: string;
}

/** Which parts are still placeholders. The web app shows this as a banner. */
export interface Health {
  ok: true;
  placeholders: {
    ai: boolean;
    import: boolean;
    voice: boolean;
  };
  models: ModelStatus[];
  /** What the AI is busy with, such as "Writing question 2 of 5". */
  activity: string | null;
}

export type Difficulty = "easy" | "medium" | "hard";

/** The language the student reads, and the AI writes, in. */
export type Language = "en" | "uz";

export interface CreateQuizRequest {
  documentIds: string[];
  count: number;
  /** Defaults to medium. */
  difficulty?: Difficulty;
  /** Defaults to English. */
  language?: Language;
}

export interface AnswerRequest {
  answer: string;
  /** Defaults to English. */
  language?: Language;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Defaults to English. */
  language?: Language;
}

/** POST /api/chat streams these as one JSON object per line. */
export type ChatEvent =
  /** Passages found in the notes. An answer cites them as [1], [2] and so on. */
  | { type: "sources"; sources: SourceRef[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };

export interface TranscribeResponse {
  text: string;
}

export interface SpeakRequest {
  text: string;
}

export interface ApiError {
  error: string;
}
