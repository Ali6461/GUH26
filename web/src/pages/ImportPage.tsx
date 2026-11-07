// PERSON 3: choose notes and start a quiz.
import { useEffect, useState, type ChangeEvent } from "react";
import type { Quiz, StudyDocument } from "../../../shared/types";
import { api } from "../api";

const QUESTION_COUNT = 5;

export function ImportPage({ onQuizReady }: { onQuizReady: (quiz: Quiz) => void }) {
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listDocuments().then(setDocuments, (e: Error) => setError(e.message));
  }, []);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void run(async () => {
      for (const file of files) {
        const document = await api.uploadDocument(file);
        setDocuments((current) => [...current, document]);
        if (document.pages.length > 0) {
          setSelected((current) => [...current, document.id]);
        }
      }
    });
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function startQuiz() {
    void run(async () => {
      const quiz = await api.createQuiz(selected, QUESTION_COUNT);
      if (quiz.questions.length === 0) {
        throw new Error("Couldn't write any questions from those notes.");
      }
      onQuizReady(quiz);
    });
  }

  return (
    <section>
      <h2>Add your notes</h2>
      <input
        type="file"
        multiple
        accept=".txt,.md,.pdf,.pptx,.png,.jpg,.jpeg,.webp"
        onChange={upload}
        disabled={busy}
      />

      <ul className="documents">
        {documents.map((document) => (
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

      {error && <p className="banner error">{error}</p>}
      <button onClick={startQuiz} disabled={busy || selected.length === 0}>
        {busy ? "Working…" : "Start quiz"}
      </button>
    </section>
  );
}
