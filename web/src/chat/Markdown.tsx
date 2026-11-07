// Shows the model's replies, which use a small part of Markdown plus LaTeX maths.
// This builds React elements, so nothing in a reply or a note can run as code. The
// one exception is KaTeX's output, which with trust off is safe to insert as HTML.
import katex from "katex";
import "katex/dist/katex.min.css";
import type { ReactNode } from "react";

interface Props {
  text: string;
  /** How many sources there are. A [n] outside this range stays as plain text. */
  sourceCount: number;
  onCite: (source: number) => void;
}

// A closing $ followed by a digit means money, as in "$5 and $10", not maths.
const INLINE =
  /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[\d+\]|\\\([^\n]+?\\\)|\\\[[^\n]+?\\\]|\$[^$\n]+\$(?!\d))/g;

function Maths({ tex, display }: { tex: string; display: boolean }) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: "ignore",
  });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderInline(
  text: string,
  { sourceCount, onCite }: Pick<Props, "sourceCount" | "onCite">,
): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{renderInline(part.slice(2, -2), { sourceCount, onCite })}</strong>;
    }
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      return <Maths key={i} tex={part.slice(1, -1)} display={false} />;
    }
    if (part.startsWith("\\(") && part.endsWith("\\)")) {
      return <Maths key={i} tex={part.slice(2, -2)} display={false} />;
    }
    if (part.startsWith("\\[") && part.endsWith("\\]")) {
      return <Maths key={i} tex={part.slice(2, -2)} display />;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const citation = part.match(/^\[(\d+)\]$/);
    if (citation && Number(citation[1]) >= 1 && Number(citation[1]) <= sourceCount) {
      const source = Number(citation[1]);
      return (
        <button
          key={i}
          type="button"
          className="citation"
          aria-label={`Show source ${source}`}
          onClick={() => onCite(source)}
        >
          [{source}]
        </button>
      );
    }
    return part;
  });
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

/** The token that closes a maths block starting on this line, if it starts one. */
function mathsBlockEnd(line: string): string | null {
  const start = line.trimStart();
  if (start.startsWith("$$")) return "$$";
  // \[ ... \] on one line is handled as inline text, which still displays it as a block.
  if (start.startsWith("\\[") && !start.includes("\\]")) return "\\]";
  return null;
}

export function Markdown(props: Props) {
  const lines = props.text.split("\n");
  const blocks: ReactNode[] = [];

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    const key = blocks.length;

    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
    } else if (mathsBlockEnd(line)) {
      const end = mathsBlockEnd(line)!;
      const first = line.trimStart().slice(2);
      const parts = [first];
      i++;
      if (!first.includes(end)) {
        while (i < lines.length && !lines[i].includes(end)) parts.push(lines[i++]);
        if (i < lines.length) parts.push(lines[i++]);
      }
      const tex = parts.join("\n");
      // While a reply is still streaming, the block may not have closed yet.
      blocks.push(
        tex.includes(end) ? (
          <Maths key={key} tex={tex.slice(0, tex.indexOf(end))} display />
        ) : (
          <pre key={key}>{tex}</pre>
        ),
      );
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const pattern = BULLET.test(line) ? BULLET : NUMBERED;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(lines[i++].replace(pattern, ""));
      }
      const children = items.map((item, n) => <li key={n}>{renderInline(item, props)}</li>);
      blocks.push(
        pattern === BULLET ? <ul key={key}>{children}</ul> : <ol key={key}>{children}</ol>,
      );
    } else if (/^#{1,6}\s+/.test(line)) {
      blocks.push(
        <p key={key}>
          <strong>{renderInline(line.replace(/^#+\s+/, ""), props)}</strong>
        </p>,
      );
      i++;
    } else if (line.trim() === "") {
      i++;
    } else {
      const paragraph: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !BULLET.test(lines[i]) &&
        !NUMBERED.test(lines[i]) &&
        !/^#{1,6}\s+/.test(lines[i]) &&
        !lines[i].trimStart().startsWith("```") &&
        !mathsBlockEnd(lines[i])
      ) {
        paragraph.push(lines[i++]);
      }
      blocks.push(<p key={key}>{renderInline(paragraph.join(" "), props)}</p>);
    }
  }
  return <>{blocks}</>;
}
