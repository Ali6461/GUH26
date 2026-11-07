# GUH26

Offline revision from messy notes. Import slides, scans and photos, then get quizzed by typing or speaking, with every question linked to its source. All AI runs on the laptop through [QVAC](https://docs.qvac.tether.io/).

> **This is a skeleton.** The app runs from start to finish, but the AI, PDF, slide, image and voice parts are placeholders. A banner in the app lists what's still fake. Connect these parts before claiming they work in the demo.

## Get started

You need [Node](https://nodejs.org/) `^22.21.0` or `>=24.9.0`. QVAC on Windows also needs Vulkan 1.4 or newer.

```bash
git clone https://github.com/Ali6461/GUH26.git
```

```bash
cd GUH26
```

```bash
npm install
```

```bash
npm run dev
```

Then open <http://127.0.0.1:5173>. To try it now, upload a `.txt` or `.md` file with a few full sentences.

## Who owns what

Each person mostly works in their own folder, so you shouldn't get many merge conflicts.

| Person | Role | Files | Branch |
|---|---|---|---|
| 1 | QVAC setup, question generation and marking | `server/src/ai/` | `person-1-ai` |
| 2 | Importing PDFs, scans and photos, plus OCR | `server/src/import/` | `person-2-import` |
| 3 | Interface and design | `web/src/` except `voice/` | `person-3-ui` |
| 4 | Speech-to-text, text-to-speech, classmate quotes and the presentation | `server/src/voice/`, `web/src/voice/` | `person-4-voice` |

The to-do list for each server role is at the top of its `index.ts`. Person 3's starting points are `App.tsx` and the files in `web/src/pages/`.

## Test these first

These could change the plan, so find out early and tell the team:

1. **Person 1:** does QVAC run the Qwen3 4B model on the demo laptop, and how fast?
2. **Person 2:** can OCR read real scans and photos of handwriting?
3. **Person 4:** can speech and the 4B model run together without running out of memory or feeling too slow?

## Working together

Start from the latest `main`, replacing the branch name with yours:

```bash
git switch main
```

```bash
git pull
```

```bash
git switch -c person-1-ai
```

Before you push, check that everything still compiles:

```bash
npm run check
```

Then push your branch and open a pull request on GitHub:

```bash
git push -u origin person-1-ai
```

To pick up your teammates' merged work, run `git fetch origin` and then `git merge origin/main` on your branch.

**Team rules:**

1. Keep `main` working, because that's what you'll demo.
2. Tell the team before changing `shared/types.ts`, because everyone depends on it.
3. Keep function signatures the same when replacing a placeholder.
4. Don't use cloud AI or external APIs.
5. Don't load anything from the internet at runtime, including fonts and scripts.
6. Don't commit model files, secrets or personal notes.

## How it fits together

```
Browser (React, port 5173)
        |
        |  /api
        v
Local Node server (port 3001)
   |-- import/   files to text
   |-- ai/       questions and marking
   |-- voice/    speech to text, text to speech
   `-- store.ts  saves to data/store.json
```

| Route | What it does |
|---|---|
| `GET /api/health` | Shows which parts are still placeholders |
| `GET /api/documents` | Lists imported notes |
| `POST /api/documents` | Imports the uploaded `file` |
| `POST /api/quizzes` | Creates a quiz from `{ documentIds, count }` |
| `POST /api/quizzes/:quizId/questions/:questionId/answer` | Marks `{ answer }` |
| `POST /api/voice/transcribe` | Turns the uploaded `audio` into text |
| `POST /api/voice/speak` | Turns `{ text }` into audio |

The data types for these routes are in `shared/types.ts`.
