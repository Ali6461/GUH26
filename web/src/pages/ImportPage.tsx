// PERSON 3: choose notes and start a quiz.
import { useState, type ChangeEvent } from "react";
import type { Difficulty, Language, Quiz } from "../../../shared/types";
import { api } from "../api";
import { ACCEPTED_FILES, type Documents } from "../chat/useDocuments";
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
  onOptionsChange: (options: QuizOptions) => void;
  onQuizReady: (quiz: Quiz) => void;
}

export function ImportPage({ documents: notes, options, onOptionsChange, onQuizReady }: Props) {
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
      // Notes removed from the sidebar may still be ticked here.
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

  return (
    <section>
      <h2>{t("makeQuiz")}</h2>
      <input
        type="file"
        multiple
        accept={ACCEPTED_FILES}
        onChange={upload}
        disabled={working}
      />

      <ul className="documents">
        {notes.documents.map((document) => (
          <li key={document.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(document.id)}
                onChange={() => toggle(document.id)}
                disabled={document.pages.length === 0}
              />
              {document.name}
            </label>
            {document.warnings.map((warning) => (
              <p className="warning" key={warning}>
                {warning}
              </p>
            ))}
          </li>
        ))}
      </ul>

      <div className="row quiz-options">
        <label>
          {t("questions")}{" "}
          <select
            value={options.count}
            disabled={working}
            onChange={(event) =>
              onOptionsChange({ ...options, count: Number(event.target.value) })
            }
          >
            {QUESTION_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("difficulty")}{" "}
          <select
            value={options.difficulty}
            disabled={working}
            onChange={(event) =>
              onOptionsChange({ ...options, difficulty: event.target.value as Difficulty })
            }
          >
            {DIFFICULTIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {t("aiLanguageWarning") && <p className="warning">{t("aiLanguageWarning")}</p>}
      {(error || notes.error) && <p className="banner error">{error || notes.error}</p>}
      <button onClick={startQuiz} disabled={working || !canStart}>
        {working ? t("working") : t("startQuiz")}
      </button>
      <p className="muted">{t("writingTime", { time: timeEstimate(options, language, t) })}</p>
    </section>
  );
}
