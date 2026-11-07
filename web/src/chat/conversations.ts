// Saved chats. They stay in this browser, on this laptop.
import type { ChatMessage, SourceRef } from "../../../shared/types";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Passages from the notes that the reply cites as [1], [2] and so on. */
  sources?: SourceRef[];
  error?: string;
  stopped?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

const STORAGE_KEY = "guh26-conversations";
const TITLE_CHARS = 40;

export function loadConversations(): Conversation[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    // Chats still work without saving, such as in a private window.
    console.warn("Couldn't save chats:", error);
  }
}

export function titleFrom(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > TITLE_CHARS ? `${flat.slice(0, TITLE_CHARS)}…` : flat;
}

/** What gets sent to the model: everything that was actually said, without failed replies. */
export function toHistory(messages: Message[]): ChatMessage[] {
  return messages
    .filter((message) => message.content.trim() !== "")
    .map(({ role, content }) => ({ role, content }));
}
