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
  appTitle: "Deadzone",
  tagline: "Revise when the signal dies",
  privacy: "AI and notes stay on this laptop.",
  statusReady: "Ready",
  statusStandby: "Standby",
  statusAnswering: "Answering",
  statusOffline: "Server offline",
  statusError: "AI error",
  modeNotes: "Notes",
  dropTitle: "Drop your notes here, or click to choose",
  dropHint: "PDF, slides, scans, photos or text, up to 50 MB each",
  pageCount: "Pages: {n}",
  modelsTitle: "AI on this laptop",
  modelMissing: "Not downloaded",
  modelDownloaded: "On this laptop",
  modelDownloading: "Downloading",
  modelLoading: "Loading",
  modelReady: "Ready",
  modelError: "Error",
  chooseNotes: "Choose notes",
  chatHint: "Chat searches all your notes.",
  mode: "Mode",
  modeChat: "Chat",
  modeQuiz: "Quiz",
  modeShared: "Shared files",
  collabIntro: "Edit a text file together with classmates on the same Wi-Fi or hotspot. No internet needed: laptops talk to each other directly.",
  collabShareFile: "Share a text file",
  collabNewFile: "New blank file",
  collabYourFiles: "Your shared files",
  collabNoneYet: "None yet.",
  collabConnected: "{n} connected",
  collabReadOnly: "read only for now",
  collabRemove: "Remove",
  collabNearby: "Nearby",
  collabNoNearby: "No one nearby is sharing a file yet. Looking…",
  collabOpen: "Open {name}",
  collabOpenUnnamed: "Open a shared file",
  collabOnLaptop: "on 1 laptop",
  collabOnLaptops: "on {n} laptops",
  collabJoinCode: "Join with a code",
  collabCodePlaceholder: "Paste the code from the other laptop",
  collabJoin: "Join",
  collabNotShowing: "Laptop not showing up?",
  collabConnectHint: "Some networks block the broadcasts used to find laptops. Connect straight to the other laptop's IP address instead. This laptop accepts connections on port {port}.",
  collabConnect: "Connect",
  collabBack: "Back",
  collabWaitingForFile: "Waiting for the file…",
  collabReconnecting: "Reconnecting to the local server…",
  collabPeersOne: "{peers} nearby laptop connected · {writers} can edit",
  collabPeersMany: "{peers} nearby laptops connected · {writers} can edit",
  collabReadOnlyNotice: "You can read this file. You'll be able to edit as soon as a laptop that already has it connects and lets you in.",
  collabNotSaved: "Not connected, so that change wasn't saved.",
  collabFileLabel: "Shared file",
  collabCopyCode: "Copy code",
  collabDownload: "Download",
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
  appTitle: "Deadzone",
  tagline: "Aloqa uzilganda ham takrorlang",
  privacy: "Sunʼiy intellekt va konspektlar shu noutbukda qoladi.",
  statusReady: "Tayyor",
  statusStandby: "Kutish",
  statusAnswering: "Javob yozmoqda",
  statusOffline: "Server oʻchiq",
  statusError: "Xatolik",
  modeNotes: "Konspektlar",
  dropTitle: "Konspektlarni shu yerga tashlang yoki tanlash uchun bosing",
  dropHint: "PDF, slaydlar, skanlar, rasmlar yoki matn, har biri 50 MB gacha",
  pageCount: "Sahifalar: {n}",
  modelsTitle: "Shu noutbukdagi sunʼiy intellekt",
  modelMissing: "Yuklab olinmagan",
  modelDownloaded: "Noutbukda bor",
  modelDownloading: "Yuklab olinmoqda",
  modelLoading: "Yuklanmoqda",
  modelReady: "Tayyor",
  modelError: "Xatolik",
  chooseNotes: "Konspektlarni tanlang",
  chatHint: "Suhbat barcha konspektlaringizdan qidiradi.",
  mode: "Rejim",
  modeChat: "Suhbat",
  modeQuiz: "Test",
  modeShared: "Umumiy fayllar",
  collabIntro: "Bir xil Wi-Fi yoki hotspotdagi kursdoshlaringiz bilan matnli faylni birga tahrirlang. Internet kerak emas: noutbuklar bir-biri bilan toʻgʻridan-toʻgʻri bogʻlanadi.",
  collabShareFile: "Matnli faylni ulashish",
  collabNewFile: "Yangi boʻsh fayl",
  collabYourFiles: "Siz ulashgan fayllar",
  collabNoneYet: "Hozircha yoʻq.",
  collabConnected: "{n} ta ulangan",
  collabReadOnly: "hozircha faqat oʻqish uchun",
  collabRemove: "Olib tashlash",
  collabNearby: "Yaqin atrofda",
  collabNoNearby: "Yaqin atrofda hali hech kim fayl ulashmayapti. Qidirilmoqda…",
  collabOpen: "{name} ni ochish",
  collabOpenUnnamed: "Umumiy faylni ochish",
  collabOnLaptop: "1 ta noutbukda",
  collabOnLaptops: "{n} ta noutbukda",
  collabJoinCode: "Kod orqali qoʻshilish",
  collabCodePlaceholder: "Boshqa noutbukdagi kodni joylang",
  collabJoin: "Qoʻshilish",
  collabNotShowing: "Noutbuk koʻrinmayaptimi?",
  collabConnectHint: "Baʼzi tarmoqlar noutbuklarni topish uchun ishlatiladigan signallarni bloklaydi. Buning oʻrniga boshqa noutbukning IP manziliga toʻgʻridan-toʻgʻri ulaning. Bu noutbuk {port}-portda ulanishlarni qabul qiladi.",
  collabConnect: "Ulanish",
  collabBack: "Orqaga",
  collabWaitingForFile: "Fayl kutilmoqda…",
  collabReconnecting: "Mahalliy serverga qayta ulanilmoqda…",
  collabPeersOne: "Yaqindagi {peers} ta noutbuk ulangan · {writers} tasi tahrirlay oladi",
  collabPeersMany: "Yaqindagi {peers} ta noutbuk ulangan · {writers} tasi tahrirlay oladi",
  collabReadOnlyNotice: "Bu faylni oʻqishingiz mumkin. Fayl allaqachon bor noutbuk ulanib, sizga ruxsat berishi bilan uni tahrirlay olasiz.",
  collabNotSaved: "Ulanish yoʻq, shuning uchun bu oʻzgarish saqlanmadi.",
  collabFileLabel: "Umumiy fayl",
  collabCopyCode: "Kodni nusxalash",
  collabDownload: "Yuklab olish",
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
