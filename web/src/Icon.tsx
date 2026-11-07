// The Deadzone icon set, drawn inline so it works offline.
const PATHS = {
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M19 11a7 7 0 0 1-14 0 M12 18v3",
  speaker: "M11 5 6 9H3v6h3l5 4V5Z M15.5 9a4 4 0 0 1 0 6 M18.5 6a8 8 0 0 1 0 12",
  stop: "M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  send: "M21 3 10 14 M21 3l-7 18-4-7-7-4 18-7Z",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v5 M14 11v5",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4",
  file: "M14 3H6v18h12V7l-4-4Z M14 3v4h4 M9 13h6 M9 17h6",
  chat: "M4 5h16v11H9l-5 4V5Z",
  quiz: "M4 7l2 2 3-4 M4 16l2 2 3-4 M13 7h7 M13 16h7",
  alert: "M12 4 2.5 20h19L12 4Z M12 10v4 M12 17v.5",
  check: "M5 12.5 10 17.5 19 7",
  cross: "M6 6l12 12 M18 6 6 18",
  plus: "M12 5v14 M5 12h14",
  copy: "M9 9h11v11H9V9Z M5 15H4V4h11v1",
  refresh: "M20 11a8 8 0 0 0-14-4L4 9 M4 4v5h5 M4 13a8 8 0 0 0 14 4l2-2 M20 20v-5h-5",
  attach: "M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
