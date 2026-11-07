// PERSON 3: the score and what to reread.
import type { MarkResult } from "../../../shared/types";

interface Props {
  results: MarkResult[];
  onRestart: () => void;
}

export function ResultsPage({ results, onRestart }: Props) {
  const correct = results.filter((result) => result.correct).length;
  const missed = results.filter((result) => !result.correct);

  return (
    <section>
      <h2>
        You got {correct} of {results.length}
      </h2>

      {missed.length > 0 && <h3>Worth rereading</h3>}
      <ul className="documents">
        {missed.map((result) => (
          <li key={result.questionId}>
            <blockquote>{result.source.quote}</blockquote>
            <p className="muted">
              From {result.source.documentName}, page {result.source.page}
            </p>
          </li>
        ))}
      </ul>

      <button onClick={onRestart}>Revise again</button>
    </section>
  );
}
