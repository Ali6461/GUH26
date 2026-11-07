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

/** Which parts are still placeholders. The web app shows this as a banner. */
export interface Health {
  ok: true;
  placeholders: {
    ai: boolean;
    import: boolean;
    voice: boolean;
  };
}

export interface CreateQuizRequest {
  documentIds: string[];
  count: number;
}

export interface AnswerRequest {
  answer: string;
}

export interface TranscribeResponse {
  text: string;
}

export interface SpeakRequest {
  text: string;
}

export interface ApiError {
  error: string;
}
