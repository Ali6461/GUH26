# GUH26

Offline revision from messy notes. Import slides, scans and photos, then get quizzed by typing or speaking, with every question linked to its source. All AI runs on the laptop through
The main premise for this idea is that it is a local model that runs as a webapp. Students will be the primary user for this and is for when there is no wifi/data access, users will be able to use this local ai to chat to qwen3-4b. It should be able to transcribe using voice. It will use RAG so students can safely import their lecture slides and materials so the model is able to securely talk to the student about their notes and for any infomation requested by the user. [QVAC](https://docs.qvac.tether.io/).

> **The backend is finished, but the web app isn't.** Importing, RAG chat, quizzes, marking and voice all run on QVAC with no placeholders. The web app still has its starter design and no chat screen, so chat can only be reached through `api.chat` in `web/src/api.ts` for now.

## Get started

You need [Node](https://nodejs.org/) `^22.21.0` or `>=24.9.0`, and about 3 GB of free disk space for the models. QVAC's docs also ask for Vulkan 1.4 or newer on Windows, though we ran it on a Vulkan 1.3 driver without problems. You don't need ffmpeg.

```bash
git clone https://github.com/Ali6461/GUH26.git
```

```bash
cd GUH26
```

```bash
npm install
```

Download the models once while you're online. They're saved in `~/.qvac`, outside this repo:

```bash
npm run models
```

From then on, the app doesn't need the internet:

```bash
npm run dev
```

Then open <http://127.0.0.1:5173> and upload your notes. You can use `.txt`, `.md`, `.pdf`, `.pptx`, `.png`, `.jpg` and `.webp` files. Export older `.ppt` slides as PDF first.

On a laptop with a dedicated graphics card, try `LLM_DEVICE=gpu` when you start the server. The default is the CPU, because it beat integrated graphics in our tests.

## Shared files

Open **Shared files** to edit a text file live with classmates on the same Wi-Fi or phone hotspot, with no internet. Share a file, and other laptops see it under **Nearby** within a few seconds. Anyone who opens it can read straight away and edit once a laptop that already has it lets them in, which happens on its own.

Each file is a [Pears Autobase](https://docs.pears.com/p2p/reference/building-blocks/autobase/) stored in `data/collab`. Laptops find each other with a UDP broadcast on port 49737 and sync over an encrypted TCP connection on the same port. Windows asks to let Node through the firewall the first time. Allow it on private networks. If a network blocks broadcasts, connect by IP address under **Laptop not showing up?**. The code lives in `server/src/collab/`, `web/src/collab/` and `shared/collab.ts`.

Anyone on the same network can see and join a shared file, so don't share private notes on public Wi-Fi.

## Who owns what

Each person mostly works in their own folder, so you shouldn't get many merge conflicts.

| Person | Role | Files | Branch |
|---|---|---|---|
| 1 | QVAC setup, question generation and marking | `server/src/ai/` | `person-1-ai` |
| 2 | Importing PDFs, scans and photos, plus OCR | `server/src/import/` | `person-2-import` |
| 3 | Interface and design | `web/src/` except `voice/` | `person-3-ui` |
| 4 | Speech-to-text, text-to-speech, classmate quotes and the presentation | `server/src/voice/`, `web/src/voice/` | `person-4-voice` |

The main work left is Person 3's: the real design and a chat screen. The starting points are `App.tsx` and the files in `web/src/pages/`. To show progress, poll `GET /api/health`, which reports each model's state and what the AI is busy with.

## What we measured

All of this ran on one laptop: Intel i5-12450H, 16 GB of RAM and integrated graphics. Run it again on the demo laptop, because the speed will differ.

| Question | Answer |
|---|---|
| Does Qwen3 4B run, and how fast? | Yes. It writes about 12 tokens a second on the CPU and 7 on integrated graphics. Chat starts answering in about 5 seconds. |
| How long do quizzes take? | About 10 seconds per question, so 5 questions take about a minute. Marking an answer takes about 7 seconds. |
| Can OCR read scans and photos? | Clean print, yes, in about 2 seconds a page. Handwriting only partly: a sideways photo of neat capitals came out as a mix of correct phrases and garbage, in about 13 seconds. The app warns about pages like this. Don't promise handwriting in the demo. |
| Can speech and the 4B model run together? | Yes. All five models took about 6.3 GB of RAM together, and speech stayed quick: about 1 second to transcribe or to read aloud. |
| Does it stay offline? | Across 96 samples while models loaded and answered, the server and QVAC held no connections beyond this laptop. Do a full test with Wi-Fi off before the demo. |

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
   |-- import/   files to text, with OCR for scans and photos
   |-- ai/       models, RAG search, chat, questions and marking
   |-- voice/    speech to text, text to speech
   `-- store.ts  saves to data/store.json (RAG vectors go in data/vectors.json)
```

| Route | What it does |
|---|---|
| `GET /api/health` | Shows each model's state and what the AI is busy with |
| `GET /api/documents` | Lists imported notes |
| `POST /api/documents` | Imports the uploaded `file` and adds it to RAG search |
| `DELETE /api/documents/:id` | Deletes notes, their search data and any quizzes built from them |
| `POST /api/chat` | Answers `{ messages }` from the notes, streaming one JSON event per line |
| `POST /api/quizzes` | Creates a quiz from `{ documentIds, count }` |
| `POST /api/quizzes/:quizId/questions/:questionId/answer` | Marks `{ answer }` |
| `POST /api/voice/transcribe` | Turns the uploaded `audio` into text. It must be WAV, which `VoiceControls` handles in the browser |
| `POST /api/voice/speak` | Turns `{ text }` into audio |

The data types for these routes are in `shared/types.ts`.
