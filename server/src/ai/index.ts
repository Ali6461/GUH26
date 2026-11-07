// PERSON 1: question generation and marking with QVAC.
//
// Everything here is a PLACEHOLDER with no AI in it. It copies sentences from
// the notes so the rest of the app has something to work with.
//
// To do:
// 1. Add @qvac/sdk and run the Qwen3 4B model on the demo laptop.
// 2. Replace generateQuestions and markAnswer. Keep the same function signatures.
// 3. Check every generated question quotes text that really is in the notes.
// 4. Set AI_IS_PLACEHOLDER to false.
import { randomUUID } from "node:crypto";
import type { MarkResult, Question, StudyDocument } from "../../../shared/types";

export const AI_IS_PLACEHOLDER = true;

export async function generateQuestions(
  documents: StudyDocument[],
  count: number,
): Promise<Question[]> {
  const passages = documents.flatMap((document) =>
    document.pages.flatMap((page) =>
      page.text
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 20)
        .map((quote) => ({
          quote,
          documentId: document.id,
          documentName: document.name,
          page: page.page,
        })),
    ),
  );

  return passages.slice(0, count).map((source) => ({
    id: randomUUID(),
    prompt: `[Placeholder] Explain this in your own words: "${source.quote}"`,
    expectedAnswer: source.quote,
    source,
  }));
}

export async function markAnswer(question: Question, answer: string): Promise<MarkResult> {
  const words = (text: string) => text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
  const given = new Set(words(answer));
  const expected = words(question.expectedAnswer);
  const matched = expected.filter((word) => given.has(word)).length;
  const correct = expected.length > 0 && matched / expected.length >= 0.5;

  return {
    questionId: question.id,
    answer,
    correct,
    feedback: `[Placeholder] Matched ${matched} of ${expected.length} key words.`,
    source: question.source,
  };
}
