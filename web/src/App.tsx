// PERSON 3: the overall flow is import, then quiz, then results.
import { useEffect, useState } from "react";
import type { Health, MarkResult, Quiz } from "../../shared/types";
import { api } from "./api";
import { ImportPage } from "./pages/ImportPage";
import { QuizPage } from "./pages/QuizPage";
import { ResultsPage } from "./pages/ResultsPage";

type Screen =
  | { name: "import" }
  | { name: "quiz"; quiz: Quiz }
  | { name: "results"; results: MarkResult[] };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "import" });
  const [health, setHealth] = useState<Health | null>(null);
  const [serverDown, setServerDown] = useState(false);

  useEffect(() => {
    api.health().then(setHealth, () => setServerDown(true));
  }, []);

  const placeholders = health
    ? Object.entries(health.placeholders)
        .filter(([, isPlaceholder]) => isPlaceholder)
        .map(([part]) => part)
    : [];

  return (
    <main className="app">
      <h1>GUH26 Revision</h1>

      {serverDown && (
        <p className="banner error">Can't reach the local server. Is it running?</p>
      )}
      {placeholders.length > 0 && (
        <p className="banner">Still placeholders: {placeholders.join(", ")}</p>
      )}

      {screen.name === "import" && (
        <ImportPage onQuizReady={(quiz) => setScreen({ name: "quiz", quiz })} />
      )}
      {screen.name === "quiz" && (
        <QuizPage
          quiz={screen.quiz}
          onFinished={(results) => setScreen({ name: "results", results })}
        />
      )}
      {screen.name === "results" && (
        <ResultsPage
          results={screen.results}
          onRestart={() => setScreen({ name: "import" })}
        />
      )}
    </main>
  );
}
