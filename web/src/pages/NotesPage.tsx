// Import notes, see what's in the app, and check which AI models are ready.
import { useState, type ChangeEvent, type DragEvent } from "react";
import type { Health, ModelState } from "../../../shared/types";
import { ACCEPTED_FILES, type Documents } from "../chat/useDocuments";
import { useLanguage, type MessageKey } from "../i18n";
import { Icon } from "../Icon";

const STATE_TEXT: Record<ModelState, MessageKey> = {
  missing: "modelMissing",
  downloaded: "modelDownloaded",
  downloading: "modelDownloading",
  loading: "modelLoading",
  ready: "modelReady",
  error: "modelError",
};

interface Props {
  documents: Documents;
  health: Health | null;
  activity: string;
  onRemove: (id: string, name: string) => void;
}

export function NotesPage({ documents: notes, health, activity, onRemove }: Props) {
  const { t } = useLanguage();
  const [dragging, setDragging] = useState(false);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void notes.upload(files);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (notes.uploading) return;
    void notes.upload(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="page">
      <label
        className={`dropzone${dragging ? " dragging" : ""}${notes.uploading ? " busy" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <Icon name="upload" size={28} />
        <strong>{notes.uploading ? t("readingNotes") : t("dropTitle")}</strong>
        <span className="muted">{notes.uploading && activity ? activity : t("dropHint")}</span>
        <input
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          onChange={choose}
          disabled={notes.uploading}
        />
      </label>

      {notes.error && <p className="banner error">{notes.error}</p>}

      <h2 className="board-label">{t("yourNotes")}</h2>
      {notes.documents.length === 0 && <p className="muted">{t("attachHint")}</p>}
      <ul className="card-list">
        {notes.documents.map((document) => (
          <li className="card note-row" key={document.id}>
            <Icon name="file" size={20} />
            <div className="note-text">
              <strong>{document.name}</strong>
              <span className="muted small">{t("pageCount", { n: document.pages.length })}</span>
              {document.warnings.map((warning) => (
                <p className="warning small" key={warning}>
                  <Icon name="alert" size={14} /> {warning}
                </p>
              ))}
            </div>
            <button
              type="button"
              className="ghost icon-only"
              aria-label={t("removeNotesLabel", { name: document.name })}
              onClick={() => onRemove(document.id, document.name)}
            >
              <Icon name="trash" />
            </button>
          </li>
        ))}
      </ul>

      <h2 className="board-label">{t("modelsTitle")}</h2>
      <ul className="card-list">
        {(health?.models ?? []).map((model) => (
          <li className="card model-row" key={model.key}>
            <div className="note-text">
              <strong>{model.label}</strong>
              <span className="muted small">
                {model.purpose} · {model.sizeMB} MB
              </span>
              {model.state === "downloading" && (
                <progress value={model.progress ?? 0} max={100} aria-label={model.label} />
              )}
            </div>
            <span className={`state state-${model.state}`}>{t(STATE_TEXT[model.state])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
