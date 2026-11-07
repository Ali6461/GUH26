// PERSON 3: choose notes and start a quiz.
import { useState, type ChangeEvent } from "react";
import type { Quiz } from "../../../shared/types";
import { api } from "../api";
import { ACCEPTED_FILES, type Documents } from "../chat/useDocuments";

const QUESTION_COUNT = 5;

interface Props {
  documents: Documents;
  onQuizReady: (quiz: Quiz) => void;
}

export function ImportPage({ documents: notes, onQuizReady }: Props) {
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
      const quiz = await api.createQuiz(known, QUESTION_COUNT);
      if (quiz.questions.length === 0) {
        throw new Error("Couldn't write any questions from those notes.");
      }
      onQuizReady(quiz);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const canStart = notes.documents.some((d) => selected.includes(d.id));

  return (
    <section>
      <h2>Make a quiz from your notes</h2>
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

      {(error || notes.error) && <p className="banner error">{error || notes.error}</p>}
      <button onClick={startQuiz} disabled={working || !canStart}>
        {working ? "Working…" : "Start quiz"}
      </button>
    </section>
  );
}
