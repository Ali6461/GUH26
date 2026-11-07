// PERSON 3: chat is the default page, and the sidebar switches to the quiz.
// The quiz flow is import, then quiz, then results.
import { useEffect, useState } from "react";
import type { Health, MarkResult, Quiz } from "../../shared/types";
import { api } from "./api";
import { useChat } from "./chat/useChat";
import { useDocuments } from "./chat/useDocuments";
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
function statusText(health: Health | null): string {
  if (!health) return "";
  const llm = health.models.find((model) => model.key === "llm");
  if (llm?.state === "downloading") {
    return `Downloading ${llm.label}: ${Math.floor(llm.progress ?? 0)}%`;
  }
  if (llm?.state === "loading") return `Loading ${llm.label}…`;
  return health.activity ?? "";
}

export function App() {
  const [view, setView] = useState<View>("chat");
  const [screen, setScreen] = useState<Screen>({ name: "import" });
  // Kept here so the settings are still there after "Revise again".
  const [quizOptions, setQuizOptions] = useState(DEFAULT_QUIZ_OPTIONS);
  const [health, setHealth] = useState<Health | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const chat = useChat();
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
  const status = statusText(health);
  const modelErrors = (health?.models ?? []).flatMap((model) => model.error ?? []);

  function openChat(open: () => void) {
    open();
    setView("chat");
  }

  function removeChat(id: string, title: string) {
    if (window.confirm(`Delete the chat "${title}"?`)) chat.remove(id);
  }

  function removeNotes(id: string, name: string) {
    const message = `Remove ${name} from the app? Chat will stop using it and its quizzes will be deleted. Your original file isn't touched.`;
    if (window.confirm(message)) void documents.remove(id);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>GUH26 Revision</h1>
        <nav className="row" aria-label="Mode">
          <button
            type="button"
            className={view === "chat" ? "" : "secondary"}
            aria-current={view === "chat" ? "page" : undefined}
            onClick={() => setView("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={view === "quiz" ? "" : "secondary"}
            aria-current={view === "quiz" ? "page" : undefined}
            onClick={() => setView("quiz")}
          >
            Quiz
          </button>
        </nav>

        <button type="button" className="secondary" onClick={() => openChat(chat.startNew)}>
          New chat
        </button>

        <h2>Chats</h2>
        {chat.conversations.length === 0 && <p className="muted">No chats yet.</p>}
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
                aria-label={`Delete chat ${conversation.title}`}
                onClick={() => removeChat(conversation.id, conversation.title)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <h2>Your notes</h2>
        {documents.documents.length === 0 && (
          <p className="muted">Attach notes to ask about them.</p>
        )}
        <ul className="sidebar-list">
          {documents.documents.map((document) => (
            <li key={document.id}>
              <span className="sidebar-item" title={document.warnings.join(" ")}>
                {document.name}
                {document.warnings.length > 0 && " (check)"}
              </span>
              <button
                type="button"
                className="sidebar-remove"
                aria-label={`Remove notes ${document.name}`}
                onClick={() => removeNotes(document.id, document.name)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        {serverDown && (
          <p className="banner error">Can't reach the local server. Is it running?</p>
        )}
        {placeholders.length > 0 && (
          <p className="banner">Still placeholders: {placeholders.join(", ")}</p>
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
