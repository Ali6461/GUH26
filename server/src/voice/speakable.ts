const MAX_SPOKEN_CHARS = 4000;

/** Citations, Markdown symbols and LaTeX commands shouldn't be read out. */
export function speakableText(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1 over $2")
    .replace(/\\[()[\]]/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/\$(?!\d)/g, " ")
    .replace(/[*_#`{}^]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SPOKEN_CHARS);
}
