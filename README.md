# slite-axi

[![npm](https://img.shields.io/npm/v/slite-axi?style=flat-square)](https://www.npmjs.com/package/slite-axi)

AXI-compliant CLI for [Slite](https://slite.com): search, read, and manage notes with
token-efficient [TOON](https://github.com/toon-format/toon) output, built on
[`axi-sdk-js`](https://github.com/kunchenguid/axi) so it follows the same
agent-ergonomic conventions as the other tools in that catalog (`gh-axi`, `tasks-axi`, `gws-axi`, ...).

> **Note on naming:** "AXI" here means *Agent eXperience Interface* — a design pattern
> for CLIs that AI agents call efficiently — **not** the ARM AMBA AXI hardware bus
> protocol. If you came looking for a hardware bus component, this is the wrong repo.

## Contents

- [Why this exists](#why-this-exists)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Authenticate](#authenticate)
- [Usage](#usage)
- [Command reference](#command-reference)
- [Design principles](#design-principles)
- [Token savings](#token-savings)
- [Security & supply chain](#security--supply-chain)
- [Development](#development)
- [Project layout](#project-layout)
- [License](#license)

## Why this exists

Agents calling the raw Slite REST API pay for full JSON payloads, 10+ field objects per
note, and multiple round trips just to confirm a write succeeded. `slite-axi` wraps the
same API but:

- trims every response to a handful of fields by default,
- truncates long note bodies with an explicit `--full` escape hatch,
- reports definitive empty states (`0 results`, never an ambiguous empty array),
- returns structured errors with stable `code`s and exit codes instead of raw
  exceptions or stack traces,
- never prompts interactively — destructive actions require an explicit flag
  (`delete ... --force`) instead of a y/n prompt an agent can't answer.

## Prerequisites

| Requirement | Version | Why |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | **>= 20** | Required by `axi-sdk-js`; this project uses the global `fetch` built into Node 20+ and ships native ESM (`"type": "module"`) — no bundler or transpiler needed. |
| npm | bundled with Node | Used to install and (optionally) publish the package. No other package manager (pnpm/yarn) is required to *use* the CLI. |
| A Slite account with API access | — | You need a workspace you're a member of. Public API access may require a paid Slite plan — check your workspace's plan if `/me` or `/notes` calls return a `403`. |
| A Slite personal API key | — | Generated in Slite under **Settings → API**. See [Authenticate](#authenticate). |

Check your Node version before installing:

```sh
node --version   # must print v20.x or higher
```

No native/compiled dependencies are used, so there's nothing OS-specific to install —
this works the same on macOS, Linux, and Windows (including WSL).

## Install

### Option A — global install from npm (recommended)

Published at [npmjs.com/package/slite-axi](https://www.npmjs.com/package/slite-axi):

```sh
npm install -g slite-axi
slite-axi --version
```

### Option B — run without installing, via `npx`

```sh
npx slite-axi search "onboarding checklist"
```

### Option C — from a source checkout (for local development)

```sh
git clone https://github.com/rockthunder/axi-slite.git
cd axi-slite
npm install          # installs the one runtime dependency, axi-sdk-js
npm link              # exposes `slite-axi` on your PATH, pointing at this checkout
slite-axi --version
```

`npm link` creates a global symlink, so edits to `src/` take effect immediately without
reinstalling. Undo it later with `npm unlink -g slite-axi`.

If you don't want it on PATH at all, invoke it directly instead:

```sh
node bin/slite-axi.js --help
```

## Authenticate

1. In Slite, go to **Settings → API** and generate a personal API key.
   Slite shows the key only once — save it somewhere safe (a password manager, not a
   file in this repo).
2. Export it in your shell:

   ```sh
   export SLITE_API_KEY=<key>
   ```

   Add that line to your shell profile (`~/.zshrc`, `~/.bashrc`) to persist it across
   sessions, or set it per-invocation: `SLITE_API_KEY=<key> slite-axi me`.

3. Optionally point at a different base URL (e.g. for a proxy or test double):

   ```sh
   export SLITE_API_BASE_URL=https://api.slite.com/v1   # default; rarely needs changing
   ```

Verify authentication works:

```sh
slite-axi me
```

A missing or invalid key fails loudly with a structured `AUTH_ERROR` and a non-zero
exit code — it never prompts for credentials interactively.

## Usage

```sh
slite-axi                                    # who am I, what next (content-first home view)
slite-axi search "onboarding checklist"
slite-axi get 01F2V...                       # truncated markdown; add --full for everything
slite-axi children 01F2V... --order-by lastEditedAt --order-dir desc
slite-axi create "Runbook" --parent 01F2V... --body-file runbook.md
slite-axi update 01F2V... --title "Runbook (v2)"
slite-axi archive 01F2V...
slite-axi unarchive 01F2V...
slite-axi verify 01F2V... --expires 2026-12-31T00:00:00Z
slite-axi flag-outdated 01F2V... --reason "superseded"
slite-axi owner 01F2V... --user 01U8X...
slite-axi delete 01F2V... --force             # permanent; no undo, --force required
slite-axi me
slite-axi user 01U8X...
slite-axi users jane
slite-axi group 01G7Z...
slite-axi groups engineering
```

Run `slite-axi <command> --help` for a command's full flag reference, or
`slite-axi --help` for the top-level command list. `slite-axi -v` / `--version`
prints the installed version.

## Command reference

| Command | Aliases | Slite endpoint | Notes |
| --- | --- | --- | --- |
| `search <query>` | `find` | `GET /search-notes` | `--parent`, `--depth`, `--review-state`, `--page`, `--hits`, `--include-archived`, `--edited-after` |
| `get <id>` | `show`, `view` | `GET /notes/{id}` | `--format md\|html\|sliteml`, `--full` to skip truncation |
| `children <id>` | `ls` | `GET /notes/{id}/children` | `--cursor`, `--order-by`, `--order-dir`, `--descendants` |
| `create <title>` | `add` | `POST /notes` | `--parent`, `--template`, `--body` / `--body-file`, `--html`, `--position` |
| `update <id>` | `edit` | `PUT /notes/{id}` | `--title`, `--body` / `--body-file`, `--html`, `--position` |
| `delete <id>` | `rm` | `DELETE /notes/{id}` | **requires `--force`**; permanent, deletes children too |
| `archive <id>` / `unarchive <id>` | — | `PUT /notes/{id}/archived` | idempotent, repeatable |
| `verify <id>` | — | `PUT /notes/{id}/verify` | `--expires <ISO8601>` |
| `flag-outdated <id>` | — | `PUT /notes/{id}/flag-as-outdated` | `--reason` |
| `owner <id>` | — | `PUT /notes/{id}/owner` | exactly one of `--user <id>` / `--group <id>` |
| `me` | — | `GET /me` | shows the authenticated user |
| `user <id>` | — | `GET /users/{id}` | |
| `users <query>` | — | `GET /users` | `--email` for an exact lookup |
| `group <id>` | — | `GET /groups/{id}` | |
| `groups <query>` | — | `GET /groups` | |

## Design principles

Every command maps to one Slite REST endpoint
([developers.slite.com](https://developers.slite.com)) and follows the AXI catalog's
shared design principles:

- **Token-efficient output** — responses render as TOON, not raw JSON (~40% fewer
  tokens for the same data).
- **Minimal default fields** — list/search/get responses return 3-5 fields by default,
  not the full API object.
- **Truncation with an escape hatch** — long note content is capped (4000 chars) with a
  size hint; pass `--full` for the complete body.
- **Definitive empty states** — `0 results` instead of an ambiguous empty array.
- **Structured errors, no prompts** — every failure is an `AxiError` with a stable
  `code` (`AUTH_ERROR`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMIT`,
  `NETWORK_ERROR`, `API_ERROR`) and a matching exit code. Unknown flags fail loudly
  rather than being silently ignored.
- **Idempotent, explicit mutations** — `delete` requires `--force`; `archive` /
  `unarchive` are separate, safely-repeatable commands rather than a single toggle.
- **Content-first home view** — running `slite-axi` with no arguments shows your
  identity and next-step suggestions, not a wall of help text.

## Token savings

`slite-axi` reduces tokens two ways, and they compound:

1. **TOON encoding.** Every command's output goes through `axi-sdk-js`'s
   `renderOutput()`, which pipes the result straight through `@toon-format/toon`'s
   `encode()` — there is no separate "JSON mode." Measured on a representative
   `search` response (2 hits, same shape `searchCommand` returns):

   | Format | Size |
   | --- | --- |
   | Raw JSON (`JSON.stringify`, pretty-printed) | 552 chars |
   | TOON (`slite-axi`'s actual output) | 344 chars |
   | **Reduction** | **38%** |

   That lines up with the ~40% TOON generally reports for arrays-of-objects data —
   exactly the shape Slite returns for note lists and search hits.

2. **Field trimming, independent of encoding.** A raw `GET /notes/{id}` from Slite
   returns 10+ fields (`id`, `title`, `parentNoteId`, `createdAt`, `updatedAt`,
   `lastEditedAt`, `archivedAt`, `url`, `listPosition`, `reviewState`, `iconColor`,
   `iconShape`, `owner`, full `content`, ...). [`getCommand`](src/commands/notes.js)
   only emits `id`, `title`, `reviewState`, `updatedAt`, `url`, `parentNoteId`, plus
   note content truncated to 4000 chars by default (`--full` for everything). Every
   list/search command does the same minimal-field projection before the object ever
   reaches the TOON encoder.

Net effect: an agent paying per token gets a smaller object encoded in a smaller
format, not just one or the other.

## Security & supply chain

This tool was built for use inside an engineering org, so its dependency footprint is
deliberately minimal and was audited before and after every dependency was added.

**Full runtime dependency tree** (`npm ls --all`):

```
slite-axi@0.1.0
└─ axi-sdk-js@0.1.13          (MIT)
   └─ @toon-format/toon@2.3.1  (MIT)
```

Two packages total. Both are pure JavaScript (no native/compiled code, no
`postinstall` scripts), and all HTTP calls in this project use Node's built-in global
`fetch` — no HTTP client library (`axios`, `node-fetch`, etc.) is pulled in.

**Known CVEs: none.** `npm audit` reports zero vulnerabilities against this exact
dependency tree:

```sh
$ npm audit --omit=dev
found 0 vulnerabilities
```

**Test-time dependencies: none.** Tests use Node's built-in `node:test` and
`node:assert` modules — there is no `devDependencies` entry in `package.json` at all,
so the test suite adds zero additional supply-chain surface.

**Re-verify at any time** — don't take the snapshot above on faith:

```sh
npm audit --omit=dev     # vulnerability scan against package-lock.json
npm ls --all              # full resolved dependency tree
npm outdated               # check for newer upstream releases
```

Because the dependency surface is this small, re-running `npm audit` before each
release is cheap enough to make a standing habit (e.g. in CI) rather than a one-time
check.

**Ongoing hygiene recommendations for this org:**

- Pin `axi-sdk-js` with `npm install axi-sdk-js@<exact-version>` (not `^`/`~` ranges) in
  any environment where unreviewed transitive upgrades are a concern, and bump
  deliberately.
- Run `npm audit --omit=dev` in CI on every PR and on a schedule (dependencies can grow
  new CVEs after they're already installed).
- Commit `package-lock.json` so installs are reproducible and auditable byte-for-byte.

## Development

```sh
npm install
npm test
```

All HTTP calls are made through an injectable `fetchImpl` (see `src/client.js`), so the
entire test suite (`test/`, 48 tests) runs fully offline against a mocked Slite API —
no network access or real API key is required to run or contribute to this project.

```sh
npm test                           # run everything
node --test test/client.test.js     # run a single file
```

### Releasing

Publishing is manual (no CI/OIDC publisher wired up yet, unlike `axi-sdk-js` and the
other AXI tools which publish via GitHub Actions):

1. Bump the version in **both** `package.json` and `src/version.js` (kept in sync by
   hand — there's no build step that derives one from the other).
2. Update this README if behavior changed.
3. Run the full check before publishing:

   ```sh
   npm test
   npm audit --omit=dev
   ```

4. Publish:

   ```sh
   npm login            # once per machine
   npm publish
   ```

5. Tag the release in git:

   ```sh
   git tag v$(node -p "require('./package.json').version")
   git push origin --tags
   ```

## Project layout

```
bin/slite-axi.js        executable entry point (fast-path for -v/--version)
src/cli.js                command dispatch table + top-level help text
src/client.js              Slite REST client (native fetch, injectable for tests)
src/context.js             builds the client used as command context
src/errors.js               structured AxiError constructors + HTTP status mapping
src/args.js                  flag-parsing helpers (shared across commands)
src/format.js                 field projection + content-truncation helpers
src/commands/notes.js          search/get/children/create/update/delete/archive/verify/...
src/commands/identity.js        me/user/users/group/groups
src/commands/home.js             content-first default view
test/                              node:test suite, 100% offline (mocked fetch)
```

## License

MIT — see [LICENSE](LICENSE).
