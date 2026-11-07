// The default page: chat with Qwen3 4B about anything, or about the imported notes.
// Enter sends, Shift+Enter starts a new line, and a reply can be stopped or regenerated.
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Markdown } from "../chat/Markdown";
import type { Conversation, Message } from "../chat/conversations";
import type { Generating, ReplyPhase } from "../chat/useChat";
import { ACCEPTED_FILES, type Documents } from "../chat/useDocuments";
import { ReadAloudButton, RecordAnswerButton } from "../voice/VoiceControls";

const PHASE_TEXT: Record<ReplyPhase, string> = {
  searching: "Searching your notes…",
  thinking: "Thinking…",
  writing: "",
};

/** Matches MAX_MESSAGE_CHARS on the server. */
const MAX_MESSAGE_CHARS = 6000;

/** How close to the bottom still counts as following the reply, in pixels. */
const STICK_DISTANCE = 80;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button type="button" className="secondary" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

interface ReplyProps {
  message: Message;
  phase: ReplyPhase | null;
  canRegenerate: boolean;
  hasNotes: boolean;
  onRegenerate: () => void;
}

function Reply({ message, phase, canRegenerate, hasNotes, onRegenerate }: ReplyProps) {
  const [openSource, setOpenSource] = useState<number | null>(null);
  const sources = message.sources ?? [];
  const inProgress = phase !== null;
  // A passage the reply didn't cite may just be a near match, so it isn't called a source.
  const cited = sources.map((_, i) => message.content.includes(`[${i + 1}]`));
  const anyCited = cited.some(Boolean);

  return (
    <article className="message assistant">
      {phase && PHASE_TEXT[phase] && <p className="muted">{PHASE_TEXT[phase]}</p>}
      <Markdown text={message.content} sourceCount={sources.length} onCite={setOpenSource} />
      {message.stopped && <p className="muted">Stopped.</p>}
      {message.error && <p className="banner error">{message.error}</p>}

      {!inProgress && sources.length > 0 && (
        <div className="sources">
          <p className="muted">
            {anyCited ? "From your notes:" : "Possibly related in your notes:"}
          </p>
          {sources.map(
            (source, i) =>
              (!anyCited || cited[i]) && (
                <div key={i}>
                  <button
                    type="button"
                    className="source"
                    aria-expanded={openSource === i + 1}
                    onClick={() => setOpenSource(openSource === i + 1 ? null : i + 1)}
                  >
                    [{i + 1}] {source.documentName}, page {source.page}
                  </button>
                  {openSource === i + 1 && <blockquote>{source.quote}</blockquote>}
                </div>
              ),
          )}
        </div>
      )}
      {!inProgress && !message.error && hasNotes && message.sources?.length === 0 && (
        <p className="muted">General knowledge, not from your notes.</p>
      )}

      {!inProgress && (
        <div className="row message-actions">
          {message.content && <CopyButton text={message.content} />}
          {message.content && <ReadAloudButton text={message.content} />}
          {canRegenerate && (
            <button type="button" className="secondary" onClick={onRegenerate}>
              Regenerate
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
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const following = useRef(true);
  const messages = conversation?.messages ?? [];
  const lastMessage = messages[messages.length - 1];
  const hasNotes = documents.documents.length > 0;

  // Follow the reply as it streams, unless the student has scrolled up to read.
  useEffect(() => {
    if (following.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lastMessage?.content, lastMessage?.id, generating?.phase]);

  // Opening a chat starts at its latest message with the cursor ready.
  useEffect(() => {
    following.current = true;
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
              <h2>What are we revising?</h2>
              <p className="muted">
                Ask Qwen3 4B anything, or attach your notes and ask about them. Everything stays
                on this laptop.
              </p>
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
                phase={
                  generating?.conversationId === conversation?.id && message === lastMessage
                    ? generating!.phase
                    : null
                }
                canRegenerate={!generating && message === lastMessage}
                hasNotes={hasNotes}
                onRegenerate={onRegenerate}
              />
            ),
          )}
        </div>
      </div>

      <div className="composer">
        <div className="chat-column">
          {documents.uploading && <p className="muted">Reading your notes…</p>}
          {documents.error && <p className="banner error">{documents.error}</p>}
          {draft.length > MAX_MESSAGE_CHARS && (
            <p className="warning">
              This message is long, so the AI will only read the first{" "}
              {MAX_MESSAGE_CHARS.toLocaleString()} characters. Attach it as notes instead to use
              all of it.
            </p>
          )}
          <textarea
            ref={input}
            aria-label="Message"
            placeholder="Message Qwen3 4B"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="row">
            <label className="attach">
              Attach notes
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILES}
                onChange={attach}
                disabled={documents.uploading}
              />
            </label>
            <RecordAnswerButton
              label="Speak"
              onTranscript={(text) =>
                setDraft((current) => (current ? `${current} ${text}` : text))
              }
            />
            <span className="spacer" />
            {generating ? (
              <button type="button" onClick={onStop}>
                Stop
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={!draft.trim()}>
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
