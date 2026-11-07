// All the chat state. It lives above the pages, so a reply keeps streaming while
// the student looks at another chat or the quiz.
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  loadConversations,
  saveConversations,
  titleFrom,
  toHistory,
  type Conversation,
  type Message,
} from "./conversations";

export type ReplyPhase = "searching" | "thinking" | "writing";

export interface Generating {
  conversationId: string;
  phase: ReplyPhase;
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Generating | null>(null);
  // The stream callbacks need the latest values without waiting for a render.
  const latest = useRef(conversations);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);

  function update(change: (current: Conversation[]) => Conversation[]) {
    latest.current = change(latest.current);
    setConversations(latest.current);
  }

  function patchMessage(
    conversationId: string,
    messageId: string,
    change: (message: Message) => Message,
  ) {
    update((current) =>
      current.map((conversation) =>
        conversation.id !== conversationId
          ? conversation
          : {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.id === messageId ? change(message) : message,
              ),
            },
      ),
    );
  }

  // Saving on every word would be wasteful, so wait until the reply has finished.
  useEffect(() => {
    if (!generating) saveConversations(conversations);
  }, [conversations, generating]);

  async function reply(conversationId: string) {
    const conversation = latest.current.find((item) => item.id === conversationId);
    if (!conversation || busy.current) return;
    busy.current = true;

    const history = toHistory(conversation.messages);
    const replyId = crypto.randomUUID();
    const controller = new AbortController();
    abort.current = controller;
    update((current) =>
      current.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              updatedAt: Date.now(),
              messages: [...item.messages, { id: replyId, role: "assistant", content: "" }],
            }
          : item,
      ),
    );
    // Keep the question if the page is closed while the model is still answering.
    saveConversations(latest.current);
    setGenerating({ conversationId, phase: "searching" });

    let finished = false;
    try {
      await api.chat(
        history,
        (event) => {
          if (event.type === "sources") {
            patchMessage(conversationId, replyId, (m) => ({ ...m, sources: event.sources }));
            setGenerating({ conversationId, phase: "thinking" });
          } else if (event.type === "delta") {
            patchMessage(conversationId, replyId, (m) => ({
              ...m,
              content: m.content + event.text,
            }));
            setGenerating({ conversationId, phase: "writing" });
          } else if (event.type === "error") {
            finished = true;
            patchMessage(conversationId, replyId, (m) => ({ ...m, error: event.error }));
          } else {
            finished = true;
          }
        },
        controller.signal,
      );
      if (!finished) {
        patchMessage(conversationId, replyId, (m) => ({
          ...m,
          error: "The connection to the local server was lost.",
        }));
      }
    } catch (error) {
      if (controller.signal.aborted) {
        patchMessage(conversationId, replyId, (m) => ({ ...m, stopped: true }));
      } else {
        const text = error instanceof Error ? error.message : "Something went wrong.";
        patchMessage(conversationId, replyId, (m) => ({ ...m, error: text }));
      }
    } finally {
      abort.current = null;
      busy.current = false;
      setGenerating(null);
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || busy.current) return;
    const message: Message = { id: crypto.randomUUID(), role: "user", content };

    let conversationId = activeId;
    if (conversationId && latest.current.some((item) => item.id === conversationId)) {
      update((current) =>
        current.map((item) =>
          item.id === conversationId
            ? { ...item, messages: [...item.messages, message] }
            : item,
        ),
      );
    } else {
      conversationId = crypto.randomUUID();
      const created: Conversation = {
        id: conversationId,
        title: titleFrom(content),
        messages: [message],
        updatedAt: Date.now(),
      };
      update((current) => [created, ...current]);
      setActiveId(conversationId);
    }
    void reply(conversationId);
  }

  /** Replaces the last reply with a new one. */
  function regenerate() {
    if (!activeId || busy.current) return;
    update((current) =>
      current.map((item) => {
        if (item.id !== activeId) return item;
        const last = item.messages[item.messages.length - 1];
        return last?.role === "assistant"
          ? { ...item, messages: item.messages.slice(0, -1) }
          : item;
      }),
    );
    void reply(activeId);
  }

  function stop() {
    abort.current?.abort();
  }

  function remove(id: string) {
    if (generating?.conversationId === id) stop();
    update((current) => current.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return {
    // Most recently used first.
    conversations: [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    active: conversations.find((item) => item.id === activeId) ?? null,
    activeId,
    generating,
    send,
    regenerate,
    stop,
    remove,
    select: setActiveId,
    startNew: () => setActiveId(null),
  };
}
