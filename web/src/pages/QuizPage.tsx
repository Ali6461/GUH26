// PERSON 3: one question at a time, answered by typing or speaking.
import { useState, type FormEvent } from "react";
import type { MarkResult, Quiz } from "../../../shared/types";
import { api } from "../api";
import type { QuizOptions } from "./ImportPage";
import { ReadAloudButton, RecordAnswerButton } from "../voice/VoiceControls";

interface Props {
  quiz: Quiz;
  options: QuizOptions;
  onFinished: (results: MarkResult[]) => void;
}

export function QuizPage({ quiz, options, onFinished }: Props) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<MarkResult | null>(null);
  const [results, setResults] = useState<MarkResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const question = quiz.questions[index];
  const isLast = index === quiz.questions.length - 1;
  const fewer = quiz.questions.length < options.count;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const marked = await api.answer(quiz.id, question.id, answer);
      setResult(marked);
      setResults((current) => [...current, marked]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't mark that answer.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (isLast) {
      onFinished(results);
      return;
    }
    setIndex(index + 1);
    setAnswer("");
    setResult(null);
  }

  return (
    <section>
      <p className="muted">
        Question {index + 1} of {quiz.questions.length} ({options.difficulty})
      </p>
      {fewer && index === 0 && (
        <p className="muted">
          You asked for {options.count}, but these notes only had enough for{" "}
          {quiz.questions.length} different questions.
        </p>
      )}
      <h2>{question.prompt}</h2>
      <ReadAloudButton text={question.prompt} />

      <form onSubmit={submit}>
        <textarea
          aria-label="Your answer"
          rows={4}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={busy || result !== null}
        />
        <div className="row">
          <RecordAnswerButton onTranscript={setAnswer} disabled={busy || result !== null} />
          <button type="submit" disabled={busy || result !== null || !answer.trim()}>
            {busy ? "Marking…" : "Submit answer"}
          </button>
        </div>
      </form>

      {error && <p className="banner error">{error}</p>}

      {result && (
        <div className={result.correct ? "result good" : "result bad"}>
          <strong>{result.correct ? "Correct" : "Not quite"}</strong>
          <p>{result.feedback}</p>
          <blockquote>{result.source.quote}</blockquote>
          <p className="muted">
            From {result.source.documentName}, page {result.source.page}
          </p>
          <button onClick={next}>{isLast ? "See results" : "Next question"}</button>
        </div>
      )}
    </section>
  );
}
