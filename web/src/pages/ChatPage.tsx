// The default page: chat with Qwen3 4B about anything, or about the imported notes.
// Enter sends, Shift+Enter starts a new line, and a reply can be stopped or regenerated.
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Markdown } from "../chat/Markdown";
import type { Conversation, Message } from "../chat/conversations";
import type { Generating, ReplyPhase } from "../chat/useChat";
import { ACCEPTED_FILES, type Documents } from "../chat/useDocuments";
import { Icon } from "../Icon";
import { useLanguage, type MessageKey } from "../i18n";
import { ReadAloudButton, RecordAnswerButton } from "../voice/VoiceControls";

const PHASE_TEXT: Record<ReplyPhase, MessageKey | null> = {
  searching: "searching",
  thinking: "thinking",
  writing: null,
};

/** Matches MAX_MESSAGE_CHARS on the server. */
const MAX_MESSAGE_CHARS = 6000;

/** How close to the bottom still counts as following the reply, in pixels. */
const STICK_DISTANCE = 80;

/**
 * Which passages to show for a reply. A passage the reply didn't cite may just be a near
 * match, so it's only shown, as possibly related, when the reply cited nothing.
 */
function shownSources(message: Message, inProgress: boolean) {
  const sources = message.sources ?? [];
  const cited = sources.map((_, i) => message.content.includes(`[${i + 1}]`));
  const anyCited = cited.some(Boolean);
  const items = sources
    .map((source, i) => ({ source, number: i + 1 }))
    .filter((_, i) => cited[i] || (!anyCited && !inProgress));
  return { items, anyCited };
}

function CopyButton({ text }: { text: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button type="button" className="ghost" onClick={copy}>
      <Icon name={copied ? "check" : "copy"} />
      {copied ? t("copied") : t("copy")}
    </button>
  );
}

interface ReplyProps {
  message: Message;
  phase: ReplyPhase | null;
  canRegenerate: boolean;
  hasNotes: boolean;
  onCite: (messageId: string, source: number) => void;
  onRegenerate: () => void;
}

function Reply({ message, phase, canRegenerate, hasNotes, onCite, onRegenerate }: ReplyProps) {
  const { t } = useLanguage();
  const inProgress = phase !== null;

  return (
    <article className="message assistant">
      {phase && PHASE_TEXT[phase] && <p className="thinking">{t(PHASE_TEXT[phase]!)}</p>}
      <div className={phase === "writing" ? "reply-body streaming" : "reply-body"}>
        <Markdown
          text={message.content}
          sourceCount={message.sources?.length ?? 0}
          onCite={(source) => onCite(message.id, source)}
        />
      </div>
      {message.stopped && <p className="muted small">{t("stopped")}</p>}
      {message.error && (
        <p className="banner error">
          <Icon name="alert" /> {message.error}
        </p>
      )}

      {!inProgress && !message.error && hasNotes && message.sources?.length === 0 && (
        <p className="not-from-notes">
          <Icon name="alert" size={16} /> {t("generalKnowledge")}
        </p>
      )}

      {!inProgress && (
        <div className="row message-actions">
          {message.content && <CopyButton text={message.content} />}
          {message.content && <ReadAloudButton text={message.content} variant="ghost" />}
          {canRegenerate && (
            <button type="button" className="ghost" onClick={onRegenerate}>
              <Icon name="refresh" />
              {t("regenerate")}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

interface Props {
  conversation: Conversation | null;
  generating: Generating | null;
  documents: Documents;
  onSend: (text: string) => void;
  onStop: () => void;
  onRegenerate: () => void;
}

export function ChatPage({
  conversation,
  generating,
  documents,
  onSend,
  onStop,
  onRegenerate,
}: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");
  const [focus, setFocus] = useState<{ messageId: string; source: number } | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const following = useRef(true);
  const messages = conversation?.messages ?? [];
  const lastMessage = messages[messages.length - 1];
  const hasNotes = documents.documents.length > 0;
  const generatingHere = generating?.conversationId === conversation?.id ? generating : null;

  // The panel follows the citation last clicked, or else the latest reply.
  const panelMessage =
    messages.find((message) => message.id === focus?.messageId) ??
    (lastMessage?.role === "assistant" ? lastMessage : undefined);
  const panel = panelMessage
    ? shownSources(panelMessage, generatingHere !== null && panelMessage === lastMessage)
    : null;

  // Follow the reply as it streams, unless the student has scrolled up to read.
  useEffect(() => {
    if (following.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lastMessage?.content, lastMessage?.id, generating?.phase]);

  // Opening a chat starts at its latest message with the cursor ready.
  useEffect(() => {
    following.current = true;
    setFocus(null);
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
    input.current?.focus();
  }, [conversation?.id]);

  // The box grows with what's typed, up to the limit set in the stylesheet.
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = "auto";
    input.current.style.height = `${input.current.scrollHeight}px`;
  }, [draft]);

  function submit() {
    if (!draft.trim() || generating) return;
    following.current = true;
    setFocus(null);
    onSend(draft);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing: Enter is confirming a word in an input method, not sending.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function attach(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void documents.upload(files);
  }

  return (
    <div className="chat-shell">
      <section className="chat">
        <div
          className="chat-log"
          ref={log}
          onScroll={(event) => {
            const box = event.currentTarget;
            following.current =
              box.scrollHeight - box.scrollTop - box.clientHeight < STICK_DISTANCE;
          }}
        >
          <div className="chat-column">
            {messages.length === 0 && (
              <div className="chat-empty">
                <h2>{t("emptyTitle")}</h2>
                <p className="muted">{t("emptyBody")}</p>
              </div>
            )}
            {messages.map((message) =>
              message.role === "user" ? (
                <article className="message user" key={message.id}>
                  {message.content}
                </article>
              ) : (
                <Reply
                  key={message.id}
                  message={message}
                  phase={generatingHere && message === lastMessage ? generatingHere.phase : null}
                  canRegenerate={!generating && message === lastMessage}
                  hasNotes={hasNotes}
                  onCite={(messageId, source) => setFocus({ messageId, source })}
                  onRegenerate={onRegenerate}
                />
              ),
            )}
          </div>
        </div>

        <div className="composer">
          <div className="chat-column">
            {documents.uploading && <p className="muted small">{t("readingNotes")}</p>}
            {documents.error && <p className="banner error">{documents.error}</p>}
            {draft.length > MAX_MESSAGE_CHARS && (
              <p className="warning small">
                {t("longMessage", { limit: MAX_MESSAGE_CHARS.toLocaleString() })}
              </p>
            )}
            {t("aiLanguageWarning") && <p className="warning small">{t("aiLanguageWarning")}</p>}
            <div className="composer-box">
              <textarea
                ref={input}
                aria-label={t("messageLabel")}
                placeholder={t("messagePlaceholder")}
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <div className="row composer-actions">
                <label className={documents.uploading ? "attach disabled" : "attach"}>
                  <Icon name="attach" />
                  {t("attachNotes")}
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_FILES}
                    onChange={attach}
                    disabled={documents.uploading}
                  />
                </label>
                <RecordAnswerButton
                  label={t("speak")}
                  onTranscript={(text) =>
                    setDraft((current) => (current ? `${current} ${text}` : text))
                  }
                />
                <span className="spacer" />
                {generating ? (
                  <button type="button" className="secondary" onClick={onStop}>
                    <Icon name="stop" />
                    {t("stop")}
                  </button>
                ) : (
                  <button type="button" onClick={submit} disabled={!draft.trim()}>
                    <Icon name="send" />
                    {t("send")}
                  </button>
                )}
              </div>
            </div>
            <p className="muted small composer-hint">{t("chatHint")}</p>
          </div>
        </div>
      </section>

      {panel && panel.items.length > 0 && (
        <aside className="sources-panel">
          <h3 className="board-label">{panel.anyCited ? t("fromNotes") : t("possiblyRelated")}</h3>
          {panel.items.map(({ source, number }) => (
            <button
              type="button"
              className="source-card"
              key={number}
              aria-pressed={focus?.messageId === panelMessage?.id && focus?.source === number}
              onClick={() => setFocus({ messageId: panelMessage!.id, source: number })}
            >
              <span className="source-head">
                <span className="source-number">[{number}]</span>
                <span className="muted small">
                  {t("sourceLabel", { name: source.documentName, page: source.page })}
                </span>
              </span>
              <span className="source-quote">{source.quote}</span>
            </button>
          ))}
        </aside>
      )}
    </div>
  );
}
