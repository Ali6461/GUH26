// PERSON 3: the Deadzone shell. Chat is the default page, with notes and the quiz beside it.
// The quiz flow is import, then quiz, then results.
import { useEffect, useState } from "react";
import type { Health, Language, MarkResult, Quiz } from "../../shared/types";
import { api } from "./api";
import { useChat } from "./chat/useChat";
import { useDocuments } from "./chat/useDocuments";
import { Icon, type IconName } from "./Icon";
import { LANGUAGE_OPTIONS, LanguageProvider, useLanguage, type MessageKey, type Translate } from "./i18n";
import { ChatPage } from "./pages/ChatPage";
import { DEFAULT_QUIZ_OPTIONS, ImportPage } from "./pages/ImportPage";
import { NotesPage } from "./pages/NotesPage";
import { QuizPage } from "./pages/QuizPage";
import { ResultsPage } from "./pages/ResultsPage";

type View = "notes" | "chat" | "quiz";

type Screen =
  | { name: "import" }
  | { name: "quiz"; quiz: Quiz }
  | { name: "results"; results: MarkResult[] };

const HEALTH_POLL_MS = 2500;

const NAV: { view: View; icon: IconName; label: MessageKey }[] = [
  { view: "notes", icon: "file", label: "modeNotes" },
  { view: "chat", icon: "chat", label: "modeChat" },
  { view: "quiz", icon: "quiz", label: "modeQuiz" },
];

/** What the chat model and the current job are doing, if anything. */
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
  const llmState = health?.models.find((model) => model.key === "llm")?.state;

  let pill = { tone: "idle", text: t("statusStandby") };
  if (serverDown) pill = { tone: "error", text: t("statusOffline") };
  else if (status) pill = { tone: "busy", text: status };
  else if (chat.generating) pill = { tone: "busy", text: t("statusAnswering") };
  else if (llmState === "error") pill = { tone: "error", text: t("statusError") };
  else if (llmState === "ready") pill = { tone: "ready", text: t("statusReady") };

  const title = NAV.find((item) => item.view === view)!.label;

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
        <div className="brand">
          <h1>{t("appTitle")}</h1>
          <p>{t("tagline")}</p>
        </div>

        <nav className="nav" aria-label={t("mode")}>
          {NAV.map((item) => (
            <button
              key={item.view}
              type="button"
              className="nav-item"
              aria-current={view === item.view ? "page" : undefined}
              onClick={() => setView(item.view)}
            >
              <Icon name={item.icon} />
              {t(item.label)}
            </button>
          ))}
        </nav>

        <button type="button" className="secondary" onClick={() => openChat(chat.startNew)}>
          <Icon name="plus" />
          {t("newChat")}
        </button>

        <div className="sidebar-chats">
          <h2>{t("chats")}</h2>
          {chat.conversations.length === 0 && <p className="muted small">{t("noChats")}</p>}
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
                  <Icon name="cross" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-foot">
          <label className="language-menu">
            <span>{t("language")}</span>
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
          <p className="muted small">{t("privacy")}</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h2>{t(title)}</h2>
          <span className={`pill pill-${pill.tone}`} role="status" title={pill.text}>
            <span className="pill-dot" />
            <span className="pill-text">{pill.text}</span>
          </span>
        </header>

        {serverDown && (
          <p className="banner error">
            <Icon name="alert" /> {t("serverDown")}
          </p>
        )}
        {placeholders.length > 0 && (
          <p className="banner">{t("placeholders", { parts: placeholders.join(", ") })}</p>
        )}
        {modelErrors.map((error) => (
          <p className="banner error" key={error}>
            <Icon name="alert" /> {error}
          </p>
        ))}

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

        {view === "notes" && (
          <div className="scroll-view">
            <NotesPage
              documents={documents}
              health={health}
              activity={status}
              onRemove={removeNotes}
            />
          </div>
        )}

        {/* Hidden rather than removed, so an unfinished quiz survives a trip to the chat. */}
        <div className="scroll-view" hidden={view !== "quiz"}>
          <div className="page">
            {screen.name === "import" && (
              <ImportPage
                documents={documents}
                options={quizOptions}
                activity={health?.activity ?? null}
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
