// PERSON 3: the score and what to reread.
import type { MarkResult } from "../../../shared/types";
import { useLanguage } from "../i18n";

interface Props {
  results: MarkResult[];
  onRestart: () => void;
}

export function ResultsPage({ results, onRestart }: Props) {
  const { t } = useLanguage();
  const correct = results.filter((result) => result.correct).length;
  const missed = results.filter((result) => !result.correct);

  return (
    <section>
      <h2 className="board-display score">{t("score", { correct, total: results.length })}</h2>

      {missed.length > 0 && <h3 className="board-label">{t("worthRereading")}</h3>}
      <ul className="card-list">
        {missed.map((result) => (
          <li className="card" key={result.questionId}>
            <blockquote>{result.source.quote}</blockquote>
            <p className="muted small">
              {t("fromSource", { name: result.source.documentName, page: result.source.page })}
            </p>
          </li>
        ))}
      </ul>

      <button onClick={onRestart}>{t("reviseAgain")}</button>
    </section>
  );
}
