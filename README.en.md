<h1 align="center">Electric Guitar Tabs</h1>

<p align="center">A guitar practice tool: read tabs, practice mode, effect tones, stem separation and MIDI to tab.</p>

<p align="center"><a href="README.cn.md">中文</a> | English</p>

Electric Guitar Tabs is a guitar tab practice app that runs in the browser. Tabs, practice settings and tones are all
kept on your own computer, and the backend only listens on `127.0.0.1`. The interface is available in Chinese and English.

## What it does

**Tabs**
- Change the speed, loop any range, count-in, a metronome that follows the tab, transpose, note names.
- Volume, solo and mute for each track.
- Import Guitar Pro, MusicXML, alphaTex and MIDI files, or start a blank tab and write your own.
- Import by link from tab sites that draw their tabs from JSON. For personal practice only: follow the terms of use of
  the site in question regarding copyright.
- MIDI files are turned into tablature on import: the rhythm is quantized, a tuning is picked, and strings and frets
  are chosen so the hand moves as little as possible.
- Edit notes directly on the tab, with undo; select beats by dragging, Shift + arrows or Shift-click, and copy them to the same or another track (not between guitar and drum tracks); while editing, change the title and artist right on the score; edit tracks, and give a drum track another drum kit.
- Drum tracks can be edited too: the panel groups the pieces as drums, hi-hat and cymbals; a click puts a piece on the beat
  or takes it off, the most used have a digit key (1 kick, 2 snare, 3 closed hi-hat…), and up and down pick one of the
  beat's notes. "New track" in the mixer adds a guitar or a drum track.
- Play at any time while editing, to hear the changes: while it plays a click on the score moves the play position and a
  drag picks a loop range; once stopped, the edit cursor is on the beat playback stopped at.

**Practice**
- Practice mode: practice speed, count-in, looped bars, metronome, automatic track switches.
- Favourites: keep the songs you like. "My tabs" sorts newest first, oldest first (by when the tab was last changed, or
  else added to the library) or by first letter.
- Playlists: when a song ends, the next one starts.

**Tones**
- Playback with SoundFont sample sets: one comes with the repository (`resources/soundfonts/Default.sf2`); put your own in
  `data/soundfonts/`.
- Your own guitar effect tones: dynamics, filter, pedal, amp, cabinet, EQ, modulation, delay and reverb, nine modules,
  each tone given to any track.

**Assistant (optional, needs a language model service)**
- The little girl with her electric guitar in the bottom-left corner: click her and three icon buttons appear
  over her head, Settings, Input and Perform; the input box is at her feet, and she answers in a comic speech bubble at
  the upper right of her head.
  Drag her anywhere on the page so she does not cover the tab; she stays where she was put.
- Perform: one click starts it and opens the key the note names are read in over the button (the tab's own or one
  picked by hand; click elsewhere to close); while she performs she does not chat, and the note names show at her upper
  right while the song plays; a second click stops. Works without a model service too.
- In Settings you write her personality and what she should know about you (name, way of talking, your level and
  habits…), kept in `data/assistant.md`.
- It can read the tab, set loop ranges and speed, turn the metronome and count-in on and off, transpose, switch tracks,
  and play or pause.
- It can edit the tab: notes, durations, techniques and bars (the edits go into the tab editor, where you save them).
- It can work on effect tones: make them, change them, and give them to tracks.
- An answer that changed the tab or tones can be undone with one button.

**Transcribe (optional, needs PyTorch)**
- Stem separation: split a song into several tracks; how many depends on the model picked.
- Audio to MIDI: turn an audio file into a MIDI file.

## Project layout

```
EGtabs/
├── web/               Front end (Vite + React + TypeScript): the Tabs, Tones and Transcribe pages and the assistant
│                      in the bottom-left corner
├── desktop/           The desktop pet (Electron): her on the desktop, see-through and on top; click her to practise
├── server/            Backend (Hono + SQLite, TypeScript run by Node directly): the routes for the library, online
│                      tabs, tone library, transcription tasks and the assistant, and the Python scripts for transcribing
├── contracts/         Data types shared by the front end and the backend
├── resources/         What comes with the repository: the built-in sample set and the demo tab
├── data/              Your own data (made on the first run, kept out of git): the library database, tab files, your
│                      sample sets and models
├── test/              End-to-end tests, and the script that downloads the test songs
├── .env.example       Template of the backend's settings: copy it to .env.local (kept out of git) and fill it in
├── .gitignore
├── AGENTS.md          Notes for development, code conventions and pitfalls (in Chinese)
├── LICENSE            MIT licence
├── README.cn.md       Chinese readme
├── README.en.md       English readme (this file)
├── package.json       npm workspaces (web, server, desktop) and the usual commands
├── package-lock.json
└── vitest.config.ts   Unit test settings
```

Tabs are rendered and played with [alphaTab](https://www.alphatab.net/).

## Running

Needs **Node.js 24 or newer** (it uses the built-in `node:sqlite`, and the backend runs TypeScript directly). So far it
has only been developed and tested on Windows; other systems have not been tried.

```bash
npm ci
npm run dev
```

Open [127.0.0.1:7273](http://127.0.0.1:7273). The page and the backend API share this one port (`server/src/dev.ts`:
Vite serves the page with hot reload, and `/api` goes to the backend).

The first run creates the `data/` folder with its database, and the `soundfonts/` and `models/` subfolders that you fill
yourself. The library starts with one demo tab, "赤より紅い夢" (`resources/songs/demo/`); delete it if you don't need it,
and it will not be added back. All your own data (songs, practice settings, tab files, playlists, tones) is in
`data/user.db`, so backing up that one folder is enough. Favourite songs are kept in `user.db` together with their tabs;
the tabs of the other songs are in numbered folders under `data/songs/`. They stay across restarts, and a song only
leaves the library when those files are deleted.

Without changing code, `npm start` builds the page and then serves the built page and the API on 7273, without Vite.

### Desktop pet (optional)

```bash
npm run desktop
```

Builds the page and starts the desktop pet (Electron): the girl with her electric guitar at the bottom right of the
desktop, see-through and on top of other windows; clicks on the empty parts go through.

- Click her: three buttons appear over her head, Settings, Input and Practise. Practise opens the practice page; while
  it is open, Practise performs (starts performing and opens the key, a second click stops).
- Double-click her or click Practise: the practice page opens in a window of its own. She stays on the desktop, on top
  of the practice window (also when it is minimized), until the app quits; the practice page shows no pet of its own.
- While the practice page is open, chatting with her works as on the page: reading and editing the tab, loops, speed
  and tones act on the song open there, and "undo these changes" works as usual; performing, she shows the note names
  of what the practice page plays. Without it she can talk and work on tones.
- Drag her anywhere on the desktop; she stays there next time (kept in `data/desktop.json`).
- Right-click menu: open the practice page, go on with the last song, start with Windows (off by default), make a
  desktop shortcut, quit.

If `npm run dev` or `npm start` already runs on 7273 she uses it; otherwise she starts the backend in the background
and stops it on quit (its output goes to `data/desktop.log`). Started from the shortcut or with Windows, nothing is
rebuilt: after changing the page's code, run `npm run build` again.

### Sample sets

Put `.sf2` / `.sf3` sample sets into `data/soundfonts/`; [Polyphone](https://www.polyphone.io) is a good place to get them.
The repository comes with GeneralUser GS (`resources/soundfonts/Default.sf2`, with three distortion guitar presets from
Bread added), which loads when the page opens; other sets are loaded by hand on the Tones page.

### Transcribe (optional)

The Transcribe page needs Python and PyTorch.

1. Set up a Python environment and install the dependencies following the steps in
   [`server/separator/requirements.txt`](server/separator/requirements.txt).
2. Before starting, set the environment variable `TABS_PYTHON` to that environment's `python.exe`.
3. Under "Processing device" you can pick the graphics card or the CPU; with an NVIDIA card, the card is the default.
4. Model files:
   - Stem separation: one folder per model in `data/models/separator/`, holding `model.ckpt` and `config.yaml`, e.g.
     `data/models/separator/BS-Roformer-SW/`. Suggested: [BS-RoFormer SW](https://huggingface.co/Noshibest/BS-Roformer-SW).
   - Audio to MIDI: one folder per model in `data/models/transcriber/`, holding `model.safetensors` (and `config.json`),
     e.g. `data/models/transcriber/muscriptor-medium/`. Suggested: [MuScriptor](https://github.com/muscriptor/muscriptor).
   - Beat tracking (optional): [beat_this](https://github.com/CPJKU/beat_this)'s `final0.ckpt`, in
     `data/models/transcriber/beat_this/`. With it, the MIDI is written at the detected tempo and bar lines; without it
     (or with "None" picked under beat tracking), it is written at the steady tempo entered in the "Tempo (BPM)" box.

   The page lists the models these two folders hold; after adding one, reload the page.

### Assistant (optional)

The assistant works with any OpenAI-compatible `/chat/completions` endpoint: an online service (such as DeepSeek) or
Ollama or LM Studio on your own machine. It is set up in `.env.local` (see Settings below), for example:

```bash
TABS_AI_BASE_URL=https://api.deepseek.com
TABS_AI_MODEL=deepseek-chat
TABS_AI_API_KEY=sk-...
```

Leave `TABS_AI_API_KEY` empty for a local service that needs no key. If the service cannot be reached the backend tries
again a few times; some relays lose the start of streamed answers, and `TABS_AI_STREAM=false` asks them for whole
answers instead. These settings take effect as soon as they are changed, without restarting the backend; when something is missing, clicking the pet says what. The key stays in the
backend and never reaches the page. With an online service, your questions and the parts of the tab the assistant
reads are sent to that service. The model must support tool calling (function calling).

## Development

```bash
npm test            # unit tests
npm run typecheck
npm run lint
npm run build
```

Notes for development, code conventions and pitfalls are in [`AGENTS.md`](AGENTS.md) (in Chinese).

## Settings (`.env.local`)

The backend's settings go in `.env.local` at the top of the repository: copy [`.env.example`](.env.example) to `.env.local` and fill
it in following its comments (`.env.local` stays out of git). One `NAME=value` per line, `#` starts a comment. A variable
already set in the system's environment wins. Apart from the assistant's three (`TABS_AI_*`), changes need the backend
restarted.

| Variable | Purpose | Default |
| --- | --- | --- |
| `TABS_DEV_PORT` | Port of `npm run dev` (page and API) | `7273` |
| `TABS_APP_PORT` | Port of `npm start` and the desktop pet (the built page and the API) | `7273` |
| `TABS_PORT` | Port when only the backend runs (`npm start -w server`) | `7274` |
| `TABS_DATA_DIR` | Data folder | `data/` in the repository |
| `TABS_PYTHON` | Python used for transcribing | `.venv` one level above the repository |
| `TABS_SEPARATOR_MODELS` | Folder of the stem separation models | `data/models/separator/` |
| `TABS_TRANSCRIBER_MODELS` | Folder of the audio to MIDI models | `data/models/transcriber/` |
| `TABS_SOUNDFONTS` | Folder of your own sample sets (the bundled one in `resources/soundfonts/` is always listed) | `data/soundfonts/` |
| `TABS_DEMO_SONGS` | Folder of the demo tabs put into the library on the first run | `resources/songs/demo/` |
| `TABS_AI_BASE_URL` | The assistant's model endpoint (`/chat/completions` is added) | none (no assistant) |
| `TABS_AI_MODEL` | Model name | none |
| `TABS_AI_API_KEY` | Key for that endpoint; not needed by a local service | none |
| `TABS_AI_STREAM` | `false`: whole answers rather than streamed ones (for services whose streaming loses text) | `true` |
| `TABS_ENV_FILE` | Use another settings file (set in the system's environment only) | `.env.local` at the top of the repository |

## Licence

The code is released under the [MIT licence](LICENSE). Only the built-in sample set and the assistant's look come with
the repository; model weights and other sample sets are not distributed with the code. Download them yourself and follow the licences of
the third-party components and data:

- The character (`web/src/assistant/pet/`): a girl named Rivus, created by [jyi2ya](https://github.com/jyi2ya) and used
  with permission. Thanks to jyi2ya for the support.
- alphaTab: MPL-2.0.
- Sample sets: the bundled `Default.sf2` holds basic instrument samples and is free to use; sets downloaded from third
  parties follow their own licences.
- Stem separation models: the licence of the third-party model you download.
- Audio to MIDI models: the licence of the third-party model you download.
- Beat tracking models: the licence of the third-party model you download.
