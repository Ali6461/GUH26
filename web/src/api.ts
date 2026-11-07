// All server calls go through here.
import type {
  ApiError,
  ChatEvent,
  ChatMessage,
  Difficulty,
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

  async deleteDocument(id: string) {
    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!response.ok) await parse<never>(response);
  },

  /** Streams an answer from the notes. Abort the signal to stop the reply early. */
  async chat(
    messages: ChatMessage[],
    onEvent: (event: ChatEvent) => void,
    signal?: AbortSignal,
  ) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
    if (!response.ok || !response.body) await parse<never>(response);

    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line) onEvent(JSON.parse(line) as ChatEvent);
      }
    }
  },

  createQuiz: (documentIds: string[], count: number, difficulty: Difficulty) =>
    postJson<Quiz>("/api/quizzes", { documentIds, count, difficulty }),

  answer: (quizId: string, questionId: string, answer: string) =>
    postJson<MarkResult>(`/api/quizzes/${quizId}/questions/${questionId}/answer`, { answer }),

  async transcribe(audio: Blob) {
    const form = new FormData();
    form.append("audio", audio, "answer.wav");
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
