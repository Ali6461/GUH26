// PERSON 3: one question at a time, answered by typing or speaking.
import { useState, type FormEvent } from "react";
import type { Difficulty, MarkResult, Quiz } from "../../../shared/types";
import { api } from "../api";
import { Icon } from "../Icon";
import { useLanguage, type MessageKey } from "../i18n";
import type { QuizOptions } from "./ImportPage";
import { ReadAloudButton, RecordAnswerButton } from "../voice/VoiceControls";

interface Props {
  quiz: Quiz;
  options: QuizOptions;
  onFinished: (results: MarkResult[]) => void;
}

const LEVELS: Record<Difficulty, MessageKey> = {
  easy: "levelEasy",
  medium: "levelMedium",
  hard: "levelHard",
};

export function QuizPage({ quiz, options, onFinished }: Props) {
  const { language, t } = useLanguage();
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
      const marked = await api.answer(quiz.id, question.id, answer, language);
      setResult(marked);
      setResults((current) => [...current, marked]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("markError"));
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
      <p className="board-label">
        {t("questionOf", {
          n: index + 1,
          total: quiz.questions.length,
          level: t(LEVELS[options.difficulty]),
        })}
      </p>
      <div className="segments" aria-hidden="true">
        {quiz.questions.map((item, i) => (
          <span key={item.id} className={i < index ? "done" : i === index ? "now" : ""} />
        ))}
      </div>
      {fewer && index === 0 && (
        <p className="muted small">
          {t("fewerQuestions", { asked: options.count, got: quiz.questions.length })}
        </p>
      )}
      <h2 className="question">{question.prompt}</h2>
      <ReadAloudButton text={question.prompt} />

      <form onSubmit={submit}>
        <textarea
          aria-label={t("yourAnswer")}
          placeholder={t("yourAnswer")}
          rows={4}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={busy || result !== null}
        />
        <div className="row">
          <RecordAnswerButton onTranscript={setAnswer} disabled={busy || result !== null} />
          <span className="spacer" />
          <button type="submit" disabled={busy || result !== null || !answer.trim()}>
            {busy ? t("marking") : t("submitAnswer")}
          </button>
        </div>
      </form>

      {error && (
        <p className="banner error">
          <Icon name="alert" /> {error}
        </p>
      )}

      {result && (
        <div
          className={result.correct ? "result good" : "result bad"}
          // The feedback can start below the fold, with the Next button out of sight.
          ref={(card) => card?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
        >
          <strong className="verdict">
            <Icon name={result.correct ? "check" : "cross"} />
            {result.correct ? t("correct") : t("notQuite")}
          </strong>
          <p>{result.feedback}</p>
          <ReadAloudButton text={result.feedback} variant="ghost" />
          <blockquote>{result.source.quote}</blockquote>
          <p className="muted small">
            {t("fromSource", { name: result.source.documentName, page: result.source.page })}
          </p>
          <button onClick={next}>{isLast ? t("seeResults") : t("nextQuestion")}</button>
        </div>
      )}
    </section>
  );
}
