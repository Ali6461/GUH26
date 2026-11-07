// Interface text in each language. To add a language, add its messages here and
// turn it on in LANGUAGE_OPTIONS.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "../../shared/types";

const en = {
  appTitle: "GUH26 Revision",
  mode: "Mode",
  modeChat: "Chat",
  modeQuiz: "Quiz",
  newChat: "New chat",
  chats: "Chats",
  noChats: "No chats yet.",
  yourNotes: "Your notes",
  attachHint: "Attach notes to ask about them.",
  notesCheck: "(check)",
  deleteChatConfirm: 'Delete the chat "{title}"?',
  deleteChatLabel: "Delete chat {title}",
  removeNotesConfirm:
    "Remove {name} from the app? Chat will stop using it and its quizzes will be deleted. Your original file isn't touched.",
  removeNotesLabel: "Remove notes {name}",
  accessibility: "Accessibility",
  language: "Language",
  comingSoon: "coming soon",
  serverDown: "Can't reach the local server. Is it running?",
  placeholders: "Still placeholders: {parts}",
  downloading: "Downloading {label}: {progress}%",
  loading: "Loading {label}…",
  activityWriting: "Writing question {n} of {total}",
  activityReading: "Reading {name}",
  activityIndexing: "Indexing {name}",
  searching: "Searching your notes…",
  thinking: "Thinking…",
  copy: "Copy",
  copied: "Copied",
  stopped: "Stopped.",
  fromNotes: "From your notes:",
  possiblyRelated: "Possibly related in your notes:",
  sourceLabel: "{name}, page {page}",
  showSource: "Show source {n}",
  generalKnowledge: "General knowledge, not from your notes.",
  aiLanguageWarning: "",
  regenerate: "Regenerate",
  emptyTitle: "What are we revising?",
  emptyBody:
    "Ask Qwen3 4B anything, or attach your notes and ask about them. Everything stays on this laptop.",
  longMessage:
    "This message is long, so the AI will only read the first {limit} characters. Attach it as notes instead to use all of it.",
  readingNotes: "Reading your notes…",
  messageLabel: "Message",
  messagePlaceholder: "Message Qwen3 4B",
  attachNotes: "Attach notes",
  speak: "Speak",
  stop: "Stop",
  send: "Send",
  makeQuiz: "Make a quiz from your notes",
  questions: "Questions",
  difficulty: "Difficulty",
  difficultyEasy: "Easy: facts and definitions",
  difficultyMedium: "Medium: explain the ideas",
  difficultyHard: "Hard: reason it through",
  levelEasy: "easy",
  levelMedium: "medium",
  levelHard: "hard",
  startQuiz: "Start quiz",
  working: "Working…",
  writingTime: "Writing the questions takes {time}.",
  aboutSeconds: "about {n} seconds",
  aboutMinute: "about a minute",
  aboutMinutes: "about {n} minutes",
  noQuestions: "Couldn't write any questions from those notes.",
  somethingWrong: "Something went wrong.",
  questionOf: "Question {n} of {total} ({level})",
  fewerQuestions:
    "You asked for {asked}, but these notes only had enough for {got} different questions.",
  yourAnswer: "Your answer",
  marking: "Marking…",
  submitAnswer: "Submit answer",
  correct: "Correct",
  notQuite: "Not quite",
  fromSource: "From {name}, page {page}",
  nextQuestion: "Next question",
  seeResults: "See results",
  markError: "Couldn't mark that answer.",
  score: "You got {correct} of {total}",
  worthRereading: "Worth rereading",
  reviseAgain: "Revise again",
};

export type MessageKey = keyof typeof en;

const uz: Record<MessageKey, string> = {
  appTitle: "GUH26 Takrorlash",
  mode: "Rejim",
  modeChat: "Suhbat",
  modeQuiz: "Test",
  newChat: "Yangi suhbat",
  chats: "Suhbatlar",
  noChats: "Hozircha suhbatlar yoʻq.",
  yourNotes: "Konspektlaringiz",
  attachHint: "Savol berish uchun konspektlaringizni biriktiring.",
  notesCheck: "(tekshiring)",
  deleteChatConfirm: "“{title}” suhbati oʻchirilsinmi?",
  deleteChatLabel: "{title} suhbatini oʻchirish",
  removeNotesConfirm:
    "{name} ilovadan olib tashlansinmi? Suhbat undan foydalanmaydi va uning testlari oʻchiriladi. Asl faylingizga tegilmaydi.",
  removeNotesLabel: "{name} konspektini olib tashlash",
  accessibility: "Qulayliklar",
  language: "Til",
  comingSoon: "tez orada",
  serverDown: "Mahalliy serverga ulanib boʻlmadi. U ishlayaptimi?",
  placeholders: "Hali tayyor emas: {parts}",
  downloading: "{label} yuklab olinmoqda: {progress}%",
  loading: "{label} yuklanmoqda…",
  activityWriting: "{total} ta savoldan {n}-savol yozilmoqda",
  activityReading: "{name} oʻqilmoqda",
  activityIndexing: "{name} indekslanmoqda",
  searching: "Konspektlaringiz qidirilmoqda…",
  thinking: "Oʻylanmoqda…",
  copy: "Nusxalash",
  copied: "Nusxalandi",
  stopped: "Toʻxtatildi.",
  fromNotes: "Konspektlaringizdan:",
  possiblyRelated: "Konspektlaringizda bogʻliq boʻlishi mumkin:",
  sourceLabel: "{name}, {page}-sahifa",
  showSource: "{n}-manbani koʻrsatish",
  generalKnowledge: "Umumiy bilim, konspektlaringizdan emas.",
  aiLanguageWarning:
    "Sunʼiy intellektning oʻzbekcha javoblarida xatolar boʻlishi mumkin. Muhim maʼlumotlarni manbalardan tekshiring.",
  regenerate: "Qayta yaratish",
  emptyTitle: "Bugun nimani takrorlaymiz?",
  emptyBody:
    "Qwen3 4B dan istalgan narsani soʻrang yoki konspektlaringizni biriktirib, ular haqida savol bering. Hammasi shu noutbukda qoladi.",
  longMessage:
    "Bu xabar uzun, shuning uchun sunʼiy intellekt faqat dastlabki {limit} ta belgini oʻqiydi. Hammasidan foydalanish uchun uni konspekt sifatida biriktiring.",
  readingNotes: "Konspektlaringiz oʻqilmoqda…",
  messageLabel: "Xabar",
  messagePlaceholder: "Qwen3 4B ga xabar yozing",
  attachNotes: "Konspekt biriktirish",
  speak: "Gapirish",
  stop: "Toʻxtatish",
  send: "Yuborish",
  makeQuiz: "Konspektlaringizdan test tuzing",
  questions: "Savollar",
  difficulty: "Qiyinlik",
  difficultyEasy: "Oson: faktlar va taʼriflar",
  difficultyMedium: "Oʻrta: gʻoyalarni tushuntirish",
  difficultyHard: "Qiyin: mantiqiy fikrlash",
  levelEasy: "oson",
  levelMedium: "oʻrta",
  levelHard: "qiyin",
  startQuiz: "Testni boshlash",
  working: "Ishlanmoqda…",
  writingTime: "Savollarni yozish {time} vaqt oladi.",
  aboutSeconds: "taxminan {n} soniya",
  aboutMinute: "taxminan bir daqiqa",
  aboutMinutes: "taxminan {n} daqiqa",
  noQuestions: "Bu konspektlardan savol tuzib boʻlmadi.",
  somethingWrong: "Nimadir notoʻgʻri ketdi.",
  questionOf: "{total} ta savoldan {n}-savol ({level})",
  fewerQuestions:
    "Siz {asked} ta savol soʻradingiz, lekin bu konspektlar faqat {got} ta turli savol uchun yetarli.",
  yourAnswer: "Javobingiz",
  marking: "Baholanmoqda…",
  submitAnswer: "Javobni yuborish",
  correct: "Toʻgʻri",
  notQuite: "Unchalik toʻgʻri emas",
  fromSource: "Manba: {name}, {page}-sahifa",
  nextQuestion: "Keyingi savol",
  seeResults: "Natijalarni koʻrish",
  markError: "Bu javobni baholab boʻlmadi.",
  score: "{total} tadan {correct} ta toʻgʻri",
  worthRereading: "Qayta oʻqishga arziydi",
  reviseAgain: "Yana takrorlash",
};

const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, uz };

/** Languages without a code are listed in the menu but can't be chosen yet. */
export const LANGUAGE_OPTIONS: { code?: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "uz", label: "Oʻzbekcha" },
  { label: "Español" },
  { label: "Français" },
  { label: "Deutsch" },
  { label: "Русский" },
  { label: "Türkçe" },
  { label: "العربية" },
  { label: "हिन्दी" },
  { label: "中文" },
];

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

const STORAGE_KEY = "guh26-language";

function loadLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "uz" ? "uz" : "en";
  } catch {
    return "en";
  }
}

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(loadLanguage);

  const t = useCallback<Translate>(
    (key, values = {}) =>
      Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        MESSAGES[language][key],
      ),
    [language],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = MESSAGES[language].appTitle;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // The choice just won't be remembered, such as in a private window.
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider.");
  return value;
}
