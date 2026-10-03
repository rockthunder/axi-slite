import {
  ensureNoUnknownFlags,
  parseIntFlag,
  requirePositional,
  takeAllFlag,
  takeBoolFlag,
  takeFlag,
} from "../args.js";
import { withTruncation, pick } from "../format.js";
import { AxiError } from "../errors.js";

const LIST_FIELDS = ["id", "title", "reviewState", "updatedAt"];

function minimalNote(note) {
  return pick(note, LIST_FIELDS);
}

export const SEARCH_HELP = `usage: slite-axi search [query] [flags]
aliases: find
flags:
  --parent <id>            restrict to descendants of a note
  --depth <n>               filter by hierarchy depth
  --review-state <state>    Verified | Outdated | VerificationRequested | VerificationExpired
  --page <n>                0-indexed page (default 0)
  --hits <n>                results per page, 1-100 (default 20)
  --include-archived         include archived notes
  --edited-after <iso8601>   only notes last edited after this timestamp
examples:
  slite-axi search "onboarding checklist"
  slite-axi search --parent 01F... --review-state Outdated
  slite-axi search --hits 50 --page 1`;

export async function searchCommand(args, client) {
  const flags = [...args];
  const query = flags[0] && !flags[0].startsWith("-") ? flags.shift() : "";
  const parentNoteId = takeFlag(flags, "--parent");
  const depth = parseIntFlag(takeFlag(flags, "--depth"), "--depth");
  const reviewState = takeFlag(flags, "--review-state");
  const page = parseIntFlag(takeFlag(flags, "--page"), "--page");
  const hitsPerPage = parseIntFlag(takeFlag(flags, "--hits"), "--hits");
  const includeArchived = takeBoolFlag(flags, "--include-archived");
  const lastEditedAfter = takeFlag(flags, "--edited-after");
  ensureNoUnknownFlags(flags);

  const result = await client.get("/search-notes", {
    query: {
      query,
      parentNoteId,
      depth,
      reviewState,
      page,
      hitsPerPage,
      includeArchived,
      lastEditedAfter,
    },
  });

  const hits = (result.hits ?? []).map((hit) =>
    pick(hit, ["id", "title", "type", "highlight", "updatedAt"]),
  );

  return {
    hits,
    total: hits.length,
    page: result.page ?? 0,
    nbPages: result.nbPages ?? (hits.length > 0 ? 1 : 0),
    help:
      hits.length === 0
        ? ["0 results. Try a broader query or drop --review-state/--parent filters."]
        : ["Run `slite-axi get <id>` to view a note's content"],
  };
}

export const GET_HELP = `usage: slite-axi get <id> [flags]
aliases: show, view
flags:
  --format <md|html|sliteml>   content format (default md)
  --full                        skip content truncation
examples:
  slite-axi get 01F2V...
  slite-axi get 01F2V... --format html --full`;

export async function getCommand(args, client) {
  const id = requirePositional(args, 0, "note id");
  const flags = args.slice(1);
  const format = takeFlag(flags, "--format") ?? "md";
  const full = takeBoolFlag(flags, "--full");
  ensureNoUnknownFlags(flags);

  const note = await client.get(`/notes/${encodeURIComponent(id)}`, {
    query: { format },
  });

  return {
    ...minimalNote(note),
    url: note.url,
    parentNoteId: note.parentNoteId ?? null,
    ...withTruncation(note.content, { full }),
    help: ["Run `slite-axi children <id>` to list sub-notes"],
  };
}

export const CHILDREN_HELP = `usage: slite-axi children <id> [flags]
aliases: ls
flags:
  --cursor <token>              pagination cursor
  --order-by <title|listPosition|lastEditedAt>
  --order-dir <asc|desc>
  --descendants                  flatten the entire subtree
examples:
  slite-axi children 01F2V...
  slite-axi children 01F2V... --order-by lastEditedAt --order-dir desc`;

export async function childrenCommand(args, client) {
  const id = requirePositional(args, 0, "note id");
  const flags = args.slice(1);
  const cursor = takeFlag(flags, "--cursor");
  const orderBy = takeFlag(flags, "--order-by");
  const orderDirection = takeFlag(flags, "--order-dir");
  const includeDescendants = takeBoolFlag(flags, "--descendants");
  ensureNoUnknownFlags(flags);

  const result = await client.get(`/notes/${encodeURIComponent(id)}/children`, {
    query: { cursor, orderBy, orderDirection, includeDescendants },
  });

  const notes = (result.notes ?? []).map(minimalNote);
  return {
    notes,
    total: result.total ?? notes.length,
    hasNextPage: Boolean(result.hasNextPage),
    nextCursor: result.nextCursor ?? null,
    help:
      notes.length === 0
        ? ["0 results. This note has no child notes."]
        : ["Pass --cursor <nextCursor> to page through more results"],
  };
}

export const CREATE_HELP = `usage: slite-axi create <title> [flags]
aliases: add
flags:
  --parent <id>            parent note id (defaults to your personal channel)
  --template <id>           template to apply
  --body <text>              markdown content
  --body-file <path>         read markdown content from a file
  --html <text>               HTML content (alternative to --body)
  --position <n|top|bottom>   sidebar position among siblings
examples:
  slite-axi create "Q3 retro" --parent 01F2V... --body "## Agenda"
  slite-axi create "Runbook" --body-file runbook.md`;

export async function createCommand(args, client, { readFile } = {}) {
  const title = requirePositional(args, 0, "title");
  const flags = args.slice(1);
  const parentNoteId = takeFlag(flags, "--parent");
  const templateId = takeFlag(flags, "--template");
  let markdown = takeFlag(flags, "--body");
  const bodyFile = takeFlag(flags, "--body-file");
  const html = takeFlag(flags, "--html");
  const listPosition = normalizePosition(takeFlag(flags, "--position"));
  ensureNoUnknownFlags(flags);

  if (bodyFile) {
    markdown = await (readFile ?? defaultReadFile)(bodyFile);
  }

  const note = await client.post("/notes", {
    title,
    parentNoteId,
    templateId,
    markdown,
    html,
    listPosition,
  });

  return {
    ...minimalNote(note),
    url: note.url,
    help: [`Run \`slite-axi get ${note.id}\` to view the new note`],
  };
}

export const UPDATE_HELP = `usage: slite-axi update <id> [flags]
aliases: edit
flags:
  --title <text>
  --body <text>              markdown content
  --body-file <path>          read markdown content from a file
  --html <text>                HTML content (alternative to --body)
  --position <n|top|bottom>    sidebar position among siblings
examples:
  slite-axi update 01F2V... --title "Q3 retro (final)"
  slite-axi update 01F2V... --body-file runbook.md`;

export async function updateCommand(args, client, { readFile } = {}) {
  const id = requirePositional(args, 0, "note id");
  const flags = args.slice(1);
  const title = takeFlag(flags, "--title");
  let markdown = takeFlag(flags, "--body");
  const bodyFile = takeFlag(flags, "--body-file");
  const html = takeFlag(flags, "--html");
  const listPosition = normalizePosition(takeFlag(flags, "--position"));
  ensureNoUnknownFlags(flags);

  if (bodyFile) {
    markdown = await (readFile ?? defaultReadFile)(bodyFile);
  }

  const note = await client.put(`/notes/${encodeURIComponent(id)}`, {
    title,
    markdown,
    html,
    listPosition,
  });

  return {
    ...minimalNote(note),
    url: note.url,
    help: [`Run \`slite-axi get ${note.id}\` to view the updated note`],
  };
}

export const DELETE_HELP = `usage: slite-axi delete <id> --force
aliases: rm
Permanently deletes a note and its children. Requires --force; there is no undo.
examples:
  slite-axi delete 01F2V... --force`;

export async function deleteCommand(args, client) {
  const id = requirePositional(args, 0, "note id");
  const flags = args.slice(1);
  const force = takeBoolFlag(flags, "--force");
  ensureNoUnknownFlags(flags);

  if (!force) {
    throw new AxiError(
      "Refusing to delete without --force",
      "VALIDATION_ERROR",
      ["Re-run with --force to permanently delete this note and its children"],
    );
  }

  await client.delete(`/notes/${encodeURIComponent(id)}`);
  return { deleted: true, id };
}

export const ARCHIVE_HELP = `usage: slite-axi archive <id>
usage: slite-axi unarchive <id>
examples:
  slite-axi archive 01F2V...
  slite-axi unarchive 01F2V...`;

export function makeArchiveCommand(archived) {
  return async function archiveCommand(args, client) {
    const id = requirePositional(args, 0, "note id");
    ensureNoUnknownFlags(args.slice(1));
    const note = await client.put(`/notes/${encodeURIComponent(id)}/archived`, {
      archived,
    });
    return { ...minimalNote(note), archivedAt: note.archivedAt ?? null };
  };
}

export const VERIFY_HELP = `usage: slite-axi verify <id> [flags]
flags:
  --expires <iso8601>   optional verification expiry
examples:
  slite-axi verify 01F2V...
  slite-axi verify 01F2V... --expires 2026-12-31T00:00:00Z`;

export async function verifyCommand(args, client) {
  const id = requirePositional(args, 0, "note id");
  const flags = args.slice(1);
  const expiresAt = takeFlag(flags, "--expires");
  ensureNoUnknownFlags(flags);

  const note = await client.put(`/notes/${encodeURIComponent(id)}/verify`, {
    expiresAt,
  });
  return { ...minimalNote(note) };
}

export const FLAG_OUTDATED_HELP = `usage: slite-axi flag-outdated <id> [flags]
flags:
  --reason <text>   optional reason shown to readers
examples:
  slite-axi flag-outdated 01F2V... --reason "superseded by new runbook"`;

export async function flagOutdatedCommand(args, client) {
  const id = requirePositional(args, 0, "note id");
  const flags = args.slice(1);
  const reason = takeFlag(flags, "--reason");
  ensureNoUnknownFlags(flags);

  const note = await client.put(`/notes/${encodeURIComponent(id)}/flag-as-outdated`, {
    reason,
  });
  return { ...minimalNote(note) };
}

export const OWNER_HELP = `usage: slite-axi owner <id> --user <userId>
usage: slite-axi owner <id> --group <groupId>
examples:
  slite-axi owner 01F2V... --user 01U8X...
  slite-axi owner 01F2V... --group 01G7Z...`;

export async function ownerCommand(args, client) {
  const id = requirePositional(args, 0, "note id");
  const flags = args.slice(1);
  const userId = takeFlag(flags, "--user");
  const groupId = takeFlag(flags, "--group");
  ensureNoUnknownFlags(flags);

  if (!userId && !groupId) {
    throw new AxiError("One of --user or --group is required", "VALIDATION_ERROR");
  }
  if (userId && groupId) {
    throw new AxiError("Pass only one of --user or --group", "VALIDATION_ERROR");
  }

  const note = await client.put(`/notes/${encodeURIComponent(id)}/owner`, {
    owner: userId ? { userId } : { groupId },
  });
  return { ...minimalNote(note), owner: note.owner ?? null };
}

function normalizePosition(value) {
  if (value === undefined) return undefined;
  if (value === "top" || value === "bottom") return value;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AxiError("--position must be a number, 'top', or 'bottom'", "VALIDATION_ERROR");
  }
  return n;
}

async function defaultReadFile(path) {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}
