# Mnemo

One memory on your machine, shared by all your coding agents. Claude Code, Codex and Mistral Vibe sessions started
from Mnemo read and write the same memory: a folder of Markdown notes, versioned with git, next to your projects. At
each message, Mnemo injects what the session should know from it, and the Context panel shows exactly what was
injected and why. The agents keep the memory up to date as they work; anything that changes what is trusted waits for
your OK. Nothing leaves your machine except what each agent already sends to its own provider.

![A Claude Code session zoomed in Mnemo. On the right, the Context panel: the notes injected into the session, the injection threshold, the ranked candidate notes with their score and reason, and the preview of one note with « Open note », « Inject » and « Set aside »](docs/images/sessions.png)

## What it does

- **Sessions side by side.** Each session is a real `claude`, `codex` or `vibe` in a terminal, started in a project
  folder. A grid groups them by project with their state (working, waiting for you, paused, to review); zoom one with
  ⌥1 to ⌥9.
- **The right context, at each message.** Mnemo ranks the notes that may help and gives the agent a few leads to read;
  a note it is sure of is injected whole. The Context panel shows the live ranking and what was injected: click a note
  to preview it, inject it by hand or set it aside.
- **A confidence score trained on you.** A small local model, shipped with starting weights, learns from your
  judgements (Memory › Train, where Claude can pre-judge for you) and from your gestures in the background.
- **Memory kept by the agent.** Through an MCP server, the agent searches the memory, reads notes and proposes changes;
  anything that changes what is trusted waits for your OK. Each session ends with a short episode of what was learned.

![The same memory in a Codex session: the notes injected from the project folder in the Context panel, and Codex proposing a new fact to the memory through the MCP server](docs/images/codex.png)

- **Documents.** Drop a spec, an email, meeting notes or a PDF: the archivist pulls out the facts worth keeping, with
  their source and date, and asks you when something contradicts what is already there.
- **Agents.** A profile sets a session's engine and model, instruction, skills, plugins and avatar. Settings › Agents
  edits it like a game character; the skills are edited there too.
- **Plain files.** It is all Markdown in `_mnemo/`, one git commit per change. Browse it as a tree or a 3D graph, edit
  it in the interface or your own editor, and `git revert` what you don't like.

![Archivist page: facts proposed by the sessions and the archivist, waiting for « Confirm », « Edit » or « Reject », the archivist session reading a dropped mailbox, and the recent documents](docs/images/archiviste.png)

## How it works

- **The memory** lives in `_mnemo/`, in the folder that holds your projects: one note per topic, project, person,
  document or session episode, one line per fact with its source, date and trust. Grammar:
  [docs/format-coffre.md](docs/format-coffre.md).
- **Search** runs locally: a SQLite full-text index, plus two optional small models (bge-m3 for meaning,
  bge-reranker-v2-m3 to reorder), about 1.6 GB of RAM, stopped when idle. Without them, search by words works fine.
- **Sessions** started from Mnemo get what their engine reads (a generated plugin for Claude Code, the command line
  and hooks for Codex, an agent profile for Mistral Vibe). Hooks have short time limits and never block a session.
- **Documents** (PDF, Word, `.eml`, `.mbox`, text) are indexed where they are, never copied; every fact points back to
  its passage.

The details are in the [usage guide](docs/usage.md).

![Memory as a 3D graph: notes for projects, clients, people, decisions, episodes and sources linked by their relations, with one note selected and its eight direct links listed](docs/images/graphe.png)

## Getting started

### The desktop app (free)

Download it from the [latest release](https://github.com/GauthierCoste/mnemo/releases/latest). You only need
git and Claude Code: the app carries its own Node.js and copy of Mnemo.

- **macOS** (Apple silicon): `Mnemo-<version>-arm64.dmg`, drag Mnemo onto Applications. It is signed ad hoc: the first
  time, confirm in System Settings › Privacy & Security (« Ouvrir quand même » (Open Anyway) on a French macOS).
- **Windows** (x64): `Mnemo-Setup-<version>-x64.exe`. It is not signed: if SmartScreen stops it, choose « More info »,
  then « Run anyway ».

See [the app's installation](docs/app/installation.md) and [usage](docs/app/usage.md).

### From the sources

You need Node.js 24 or later, git, pnpm and the `claude` command line tool (optionally Codex or Mistral Vibe). Then:

```sh
git clone https://github.com/GauthierCoste/mnemo.git && cd mnemo && pnpm installer
mnemo ~/Projects        # the interface opens at http://127.0.0.1:4747/
```

`pnpm installer` builds the interface and runs `mnemo init`, which asks for the folder that holds your projects and
what to install. Everything else is in [installation.md](docs/installation.md).

## Privacy

Everything stays on your machine. The service only listens on `127.0.0.1`, behind a token, and the models run locally;
the only download is the optional models, with checked hashes. Your sessions talk to Anthropic, OpenAI or Mistral like
any other session of their engine. Recognised secrets are masked before anything is written or indexed.

## Status

Version 1.12.4. Mnemo runs on macOS and Windows (x64; the desktop app is checked by the CI, not yet tried in real use);
Linux has not been used. The CI runs the type check and the tests on Linux, macOS and Windows at each push. What comes
next is in [coming next](docs/coming-next.md).

The interface is in French or English (a setting, see [usage](docs/usage.md#language)); the `mnemo` command line is in French; this README and the docs are in English.

## Documentation

- [Installation](docs/installation.md): requirements, settings, uninstalling.
- [Usage](docs/usage.md): command line, service, sessions, profiles, interface and shortcuts.
- [The desktop app](docs/app/installation.md) for macOS and Windows.
- [Memory format](docs/format-coffre.md), [document size limits](docs/references/document-limits.md),
  [memory implementation guide](docs/references/guide-memoire.md).
- [Coming next](docs/coming-next.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT with the Commons Clause](LICENSE): you may use, copy, modify and share Mnemo freely, including inside a company, but
you may not sell it: no paid product, hosting or support service whose value comes from Mnemo. This makes Mnemo
source-available, not open source in the OSI sense. For a commercial use, ask the author.
