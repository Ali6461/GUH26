// PERSON 3: chat is the default page, and the sidebar switches to the quiz.
// The quiz flow is import, then quiz, then results.
import { useEffect, useState } from "react";
import type { Health, Language, MarkResult, Quiz } from "../../shared/types";
import { api } from "./api";
import { useChat } from "./chat/useChat";
import { useDocuments } from "./chat/useDocuments";
import { LANGUAGE_OPTIONS, LanguageProvider, useLanguage, type Translate } from "./i18n";
import { ChatPage } from "./pages/ChatPage";
import { DEFAULT_QUIZ_OPTIONS, ImportPage } from "./pages/ImportPage";
import { QuizPage } from "./pages/QuizPage";
import { ResultsPage } from "./pages/ResultsPage";

type View = "chat" | "quiz";

type Screen =
  | { name: "import" }
  | { name: "quiz"; quiz: Quiz }
  | { name: "results"; results: MarkResult[] };

const HEALTH_POLL_MS = 2500;

/** What the banner should say about the chat model and the current job, if anything. */
function statusText(health: Health | null, t: Translate): string {
  if (!health) return "";
  const llm = health.models.find((model) => model.key === "llm");
  if (llm?.state === "downloading") {
    return t("downloading", { label: llm.label, progress: Math.floor(llm.progress ?? 0) });
  }
  if (llm?.state === "loading") return t("loading", { label: llm.label });

  // The server describes its work in English, so translate the sentences it uses.
  const activity = health.activity ?? "";
  const writing = activity.match(/^Writing question (\d+) of (\d+)$/);
  if (writing) return t("activityWriting", { n: writing[1], total: writing[2] });
  const reading = activity.match(/^Reading (.+)$/);
  if (reading) return t("activityReading", { name: reading[1] });
  const indexing = activity.match(/^Indexing (.+) \(/);
  if (indexing) return t("activityIndexing", { name: indexing[1] });
  return activity;
}

export function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function AppContent() {
  const { language, setLanguage, t } = useLanguage();
  const [view, setView] = useState<View>("chat");
  const [screen, setScreen] = useState<Screen>({ name: "import" });
  // Kept here so the settings are still there after "Revise again".
  const [quizOptions, setQuizOptions] = useState(DEFAULT_QUIZ_OPTIONS);
  const [health, setHealth] = useState<Health | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const chat = useChat(language);
  const documents = useDocuments();
  const { reload } = documents;

  useEffect(() => {
    const check = () =>
      api.health().then(
        (next) => {
          setHealth(next);
          setServerDown(false);
        },
        () => setServerDown(true),
      );
    void check();
    const timer = setInterval(check, HEALTH_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // The list couldn't load while the server was down, so fetch it when it comes back.
  useEffect(() => {
    if (!serverDown) reload();
  }, [serverDown, reload]);

  const placeholders = health
    ? Object.entries(health.placeholders)
        .filter(([, isPlaceholder]) => isPlaceholder)
        .map(([part]) => part)
    : [];
  const status = statusText(health, t);
  const modelErrors = (health?.models ?? []).flatMap((model) => model.error ?? []);

  function openChat(open: () => void) {
    open();
    setView("chat");
  }

  function removeChat(id: string, title: string) {
    if (window.confirm(t("deleteChatConfirm", { title }))) chat.remove(id);
  }

  function removeNotes(id: string, name: string) {
    if (window.confirm(t("removeNotesConfirm", { name }))) void documents.remove(id);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>{t("appTitle")}</h1>
        <nav className="row" aria-label={t("mode")}>
          <button
            type="button"
            className={view === "chat" ? "" : "secondary"}
            aria-current={view === "chat" ? "page" : undefined}
            onClick={() => setView("chat")}
          >
            {t("modeChat")}
          </button>
          <button
            type="button"
            className={view === "quiz" ? "" : "secondary"}
            aria-current={view === "quiz" ? "page" : undefined}
            onClick={() => setView("quiz")}
          >
            {t("modeQuiz")}
          </button>
        </nav>

        <button type="button" className="secondary" onClick={() => openChat(chat.startNew)}>
          {t("newChat")}
        </button>

        <h2>{t("chats")}</h2>
        {chat.conversations.length === 0 && <p className="muted">{t("noChats")}</p>}
        <ul className="sidebar-list">
          {chat.conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                className="sidebar-item"
                aria-current={
                  view === "chat" && conversation.id === chat.activeId ? "true" : undefined
                }
                onClick={() => openChat(() => chat.select(conversation.id))}
              >
                {conversation.title}
              </button>
              <button
                type="button"
                className="sidebar-remove"
                aria-label={t("deleteChatLabel", { title: conversation.title })}
                onClick={() => removeChat(conversation.id, conversation.title)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <h2>{t("yourNotes")}</h2>
        {documents.documents.length === 0 && (
          <p className="muted">{t("attachHint")}</p>
        )}
        <ul className="sidebar-list">
          {documents.documents.map((document) => (
            <li key={document.id}>
              <span className="sidebar-item" title={document.warnings.join(" ")}>
                {document.name}
                {document.warnings.length > 0 && ` ${t("notesCheck")}`}
              </span>
              <button
                type="button"
                className="sidebar-remove"
                aria-label={t("removeNotesLabel", { name: document.name })}
                onClick={() => removeNotes(document.id, document.name)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <h2>{t("accessibility")}</h2>
        <label className="language-menu">
          {t("language")}{" "}
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
          >
            {LANGUAGE_OPTIONS.map(({ code, label }) => (
              <option key={label} value={code ?? label} disabled={!code}>
                {code ? label : `${label} (${t("comingSoon")})`}
              </option>
            ))}
          </select>
        </label>
      </aside>

      <main className="main">
        {serverDown && (
          <p className="banner error">{t("serverDown")}</p>
        )}
        {placeholders.length > 0 && (
          <p className="banner">{t("placeholders", { parts: placeholders.join(", ") })}</p>
        )}
        {modelErrors.map((error) => (
          <p className="banner error" key={error}>
            {error}
          </p>
        ))}
        {status && <p className="banner">{status}</p>}

        {view === "chat" && (
          <ChatPage
            conversation={chat.active}
            generating={chat.generating}
            documents={documents}
            onSend={chat.send}
            onStop={chat.stop}
            onRegenerate={chat.regenerate}
          />
        )}

        {/* Hidden rather than removed, so an unfinished quiz survives a trip to the chat. */}
        <div className="quiz-view" hidden={view !== "quiz"}>
          <div className="app">
            {screen.name === "import" && (
              <ImportPage
                documents={documents}
                options={quizOptions}
                onOptionsChange={setQuizOptions}
                onQuizReady={(quiz) => setScreen({ name: "quiz", quiz })}
              />
            )}
            {screen.name === "quiz" && (
              <QuizPage
                quiz={screen.quiz}
                options={quizOptions}
                onFinished={(results) => setScreen({ name: "results", results })}
              />
            )}
            {screen.name === "results" && (
              <ResultsPage
                results={screen.results}
                onRestart={() => setScreen({ name: "import" })}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
