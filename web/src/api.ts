// All server calls go through here.
import type {
  ApiError,
  Health,
  MarkResult,
  Quiz,
  StudyDocument,
  TranscribeResponse,
} from "../../shared/types";

async function parse<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const body = (await response.json().catch(() => null)) as ApiError | null;
  throw new Error(body?.error ?? `Request failed (${response.status}).`);
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((response) => parse<T>(response));
}

export const api = {
  health: () => fetch("/api/health").then((r) => parse<Health>(r)),

  listDocuments: () => fetch("/api/documents").then((r) => parse<StudyDocument[]>(r)),

  uploadDocument(file: File) {
    const form = new FormData();
    form.append("file", file);
    return fetch("/api/documents", { method: "POST", body: form }).then((r) =>
      parse<StudyDocument>(r),
    );
  },

  createQuiz: (documentIds: string[], count: number) =>
    postJson<Quiz>("/api/quizzes", { documentIds, count }),

  answer: (quizId: string, questionId: string, answer: string) =>
    postJson<MarkResult>(`/api/quizzes/${quizId}/questions/${questionId}/answer`, { answer }),

  async transcribe(audio: Blob) {
    const form = new FormData();
    form.append("audio", audio, "answer.webm");
    const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
    return (await parse<TranscribeResponse>(response)).text;
  },

  async speak(text: string) {
    const response = await fetch("/api/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) await parse<never>(response);
    return response.blob();
  },
};
