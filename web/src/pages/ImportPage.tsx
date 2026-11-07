// PERSON 3: choose notes and start a quiz.
import { useState, type ChangeEvent } from "react";
import type { Difficulty, Language, Quiz } from "../../../shared/types";
import { api } from "../api";
import { ACCEPTED_FILES, type Documents } from "../chat/useDocuments";
import { Icon } from "../Icon";
import { useLanguage, type MessageKey, type Translate } from "../i18n";

const QUESTION_COUNTS = [3, 5, 10, 15];
const DIFFICULTIES: { value: Difficulty; label: MessageKey }[] = [
  { value: "easy", label: "difficultyEasy" },
  { value: "medium", label: "difficultyMedium" },
  { value: "hard", label: "difficultyHard" },
];
/** Measured on 171 pages of real notes with a laptop CPU. Medium is an estimate. */
const SECONDS_PER_QUESTION: Record<Difficulty, number> = { easy: 15, medium: 15, hard: 25 };

export interface QuizOptions {
  count: number;
  difficulty: Difficulty;
}

export const DEFAULT_QUIZ_OPTIONS: QuizOptions = { count: 5, difficulty: "medium" };

function timeEstimate({ count, difficulty }: QuizOptions, language: Language, t: Translate): string {
  // Each question also has to be translated.
  const seconds = count * SECONDS_PER_QUESTION[difficulty] * (language === "en" ? 1 : 2);
  if (seconds < 60) return t("aboutSeconds", { n: seconds });
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? t("aboutMinute") : t("aboutMinutes", { n: minutes });
}

interface Props {
  documents: Documents;
  options: QuizOptions;
  /** The server's description of its current job. */
  activity: string | null;
  onOptionsChange: (options: QuizOptions) => void;
  onQuizReady: (quiz: Quiz) => void;
}

export function ImportPage({
  documents: notes,
  options,
  activity,
  onOptionsChange,
  onQuizReady,
}: Props) {
  const { language, t } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const working = busy || notes.uploading;

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void notes.upload(files).then((added) => {
      const readable = added.filter((document) => document.pages.length > 0);
      setSelected((current) => [...current, ...readable.map((document) => document.id)]);
    });
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function startQuiz() {
    setBusy(true);
    setError("");
    try {
      // Notes removed elsewhere may still be ticked here.
      const known = selected.filter((id) => notes.documents.some((d) => d.id === id));
      const quiz = await api.createQuiz(known, options.count, options.difficulty, language);
      if (quiz.questions.length === 0) {
        throw new Error(t("noQuestions"));
      }
      onQuizReady(quiz);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const canStart = notes.documents.some((d) => selected.includes(d.id));

  if (busy) {
    const writing = activity?.match(/^Writing question (\d+) of (\d+)$/);
    const current = writing ? Number(writing[1]) : 0;
    const total = writing ? Number(writing[2]) : options.count;
    return (
      <section className="writing-board" role="status">
        <p className="board-display">
          {writing ? t("activityWriting", { n: current, total }) : t("working")}
        </p>
        <div className="segments" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i + 1 < current ? "done" : i + 1 === current ? "now" : ""} />
          ))}
        </div>
        <p className="muted">{t("writingTime", { time: timeEstimate(options, language, t) })}</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="page-title">{t("makeQuiz")}</h2>

      <div className="section-head">
        <h3 className="board-label">{t("chooseNotes")}</h3>
        <label className={working ? "attach disabled" : "attach"}>
          <Icon name="attach" />
          {t("attachNotes")}
          <input
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            onChange={upload}
            disabled={working}
          />
        </label>
      </div>

      {notes.documents.length === 0 && <p className="muted">{t("attachHint")}</p>}
      <ul className="card-list">
        {notes.documents.map((document) => (
          <li key={document.id}>
            <label
              className={`card picker-row${selected.includes(document.id) ? " selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(document.id)}
                onChange={() => toggle(document.id)}
                disabled={document.pages.length === 0}
              />
              <span className="note-text">
                <strong>{document.name}</strong>
                <span className="muted small">{t("pageCount", { n: document.pages.length })}</span>
                {document.warnings.map((warning) => (
                  <span className="warning small" key={warning}>
                    {warning}
                  </span>
                ))}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <h3 className="board-label">{t("questions")}</h3>
      <div className="segmented" role="group" aria-label={t("questions")}>
        {QUESTION_COUNTS.map((count) => (
          <button
            key={count}
            type="button"
            aria-pressed={options.count === count}
            disabled={working}
            onClick={() => onOptionsChange({ ...options, count })}
          >
            {count}
          </button>
        ))}
      </div>

      <h3 className="board-label">{t("difficulty")}</h3>
      <div className="difficulty" role="group" aria-label={t("difficulty")}>
        {DIFFICULTIES.map(({ value, label }) => {
          const [name, detail] = t(label).split(": ");
          return (
            <button
              key={value}
              type="button"
              aria-pressed={options.difficulty === value}
              disabled={working}
              onClick={() => onOptionsChange({ ...options, difficulty: value })}
            >
              <strong>{name}</strong>
              <span className="small">{detail}</span>
            </button>
          );
        })}
      </div>

      {t("aiLanguageWarning") && <p className="warning small">{t("aiLanguageWarning")}</p>}
      {(error || notes.error) && (
        <p className="banner error">
          <Icon name="alert" /> {error || notes.error}
        </p>
      )}
      <div className="row start-row">
        <button onClick={startQuiz} disabled={working || !canStart}>
          <Icon name="quiz" />
          {working ? t("working") : t("startQuiz")}
        </button>
        <span className="muted small">
          {t("writingTime", { time: timeEstimate(options, language, t) })}
        </span>
      </div>
    </section>
  );
}
