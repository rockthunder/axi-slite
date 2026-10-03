import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  childrenCommand,
  createCommand,
  deleteCommand,
  flagOutdatedCommand,
  getCommand,
  makeArchiveCommand,
  ownerCommand,
  searchCommand,
  updateCommand,
  verifyCommand,
} from "../src/commands/notes.js";

function fakeClient(impl) {
  return {
    get: impl.get ?? (async () => { throw new Error("unexpected get"); }),
    post: impl.post ?? (async () => { throw new Error("unexpected post"); }),
    put: impl.put ?? (async () => { throw new Error("unexpected put"); }),
    delete: impl.delete ?? (async () => { throw new Error("unexpected delete"); }),
  };
}

test("searchCommand sends query flags and trims hits to minimal fields", async () => {
  let seenPath, seenQuery;
  const client = fakeClient({
    get: async (path, opts) => {
      seenPath = path;
      seenQuery = opts.query;
      return {
        hits: [
          { id: "n1", title: "Doc", type: "rich_text", highlight: "...match...", updatedAt: "t", extra: "drop me" },
        ],
        page: 0,
        nbPages: 1,
      };
    },
  });

  const result = await searchCommand(["onboarding", "--hits", "5", "--review-state", "Verified"], client);

  assert.equal(seenPath, "/search-notes");
  assert.equal(seenQuery.query, "onboarding");
  assert.equal(seenQuery.hitsPerPage, 5);
  assert.equal(seenQuery.reviewState, "Verified");
  assert.deepEqual(result.hits, [
    { id: "n1", title: "Doc", type: "rich_text", highlight: "...match...", updatedAt: "t" },
  ]);
  assert.equal(result.total, 1);
});

test("searchCommand reports a definitive empty state", async () => {
  const client = fakeClient({ get: async () => ({ hits: [], page: 0, nbPages: 0 }) });
  const result = await searchCommand([], client);
  assert.deepEqual(result.hits, []);
  assert.match(result.help[0], /0 results/);
});

test("searchCommand rejects unknown flags", async () => {
  const client = fakeClient({ get: async () => ({ hits: [] }) });
  await assert.rejects(() => searchCommand(["q", "--bogus"], client), /Unknown flag/);
});

test("getCommand truncates long content by default and allows --full", async () => {
  const longContent = "x".repeat(5000);
  const client = fakeClient({
    get: async (path, opts) => {
      assert.equal(path, "/notes/n1");
      assert.equal(opts.query.format, "md");
      return { id: "n1", title: "Doc", reviewState: "Verified", updatedAt: "t", url: "u", content: longContent };
    },
  });

  const truncated = await getCommand(["n1"], client);
  assert.equal(truncated.truncated, true);
  assert.equal(truncated.content.length, 4000);

  const full = await getCommand(["n1", "--full"], client);
  assert.equal(full.truncated, false);
  assert.equal(full.content.length, 5000);
});

test("getCommand requires a note id", async () => {
  await assert.rejects(() => getCommand([], fakeClient({})), /note id is required/);
});

test("childrenCommand returns minimal fields plus pagination metadata", async () => {
  const client = fakeClient({
    get: async (path) => {
      assert.equal(path, "/notes/n1/children");
      return { notes: [{ id: "c1", title: "Child", reviewState: "Verified", updatedAt: "t" }], total: 1, hasNextPage: false };
    },
  });
  const result = await childrenCommand(["n1"], client);
  assert.equal(result.notes.length, 1);
  assert.equal(result.total, 1);
  assert.equal(result.nextCursor, null);
});

test("createCommand posts markdown body and surfaces a follow-up hint", async () => {
  const client = fakeClient({
    post: async (path, body) => {
      assert.equal(path, "/notes");
      assert.equal(body.title, "Runbook");
      assert.equal(body.markdown, "# Runbook");
      return { id: "n9", title: "Runbook", reviewState: "Verified", updatedAt: "t", url: "https://slite.com/n9" };
    },
  });
  const result = await createCommand(["Runbook", "--body", "# Runbook"], client);
  assert.equal(result.id, "n9");
  assert.match(result.help[0], /slite-axi get n9/);
});

test("createCommand reads --body-file from disk", async () => {
  const dir = await mkdtemp(join(tmpdir(), "slite-axi-"));
  const file = join(dir, "body.md");
  await writeFile(file, "## From file", "utf8");
  try {
    const client = fakeClient({
      post: async (_path, body) => {
        assert.equal(body.markdown, "## From file");
        return { id: "n10", title: "T", reviewState: "Verified", updatedAt: "t", url: "u" };
      },
    });
    await createCommand(["T", "--body-file", file], client);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("updateCommand puts only the provided fields", async () => {
  const client = fakeClient({
    put: async (path, body) => {
      assert.equal(path, "/notes/n1");
      assert.equal(body.title, "New title");
      return { id: "n1", title: "New title", reviewState: "Verified", updatedAt: "t", url: "u" };
    },
  });
  const result = await updateCommand(["n1", "--title", "New title"], client);
  assert.equal(result.title, "New title");
});

test("deleteCommand refuses without --force", async () => {
  await assert.rejects(() => deleteCommand(["n1"], fakeClient({})), /--force/);
});

test("deleteCommand deletes when --force is passed", async () => {
  let called = false;
  const client = fakeClient({
    delete: async (path) => {
      called = true;
      assert.equal(path, "/notes/n1");
    },
  });
  const result = await deleteCommand(["n1", "--force"], client);
  assert.equal(called, true);
  assert.deepEqual(result, { deleted: true, id: "n1" });
});

test("archive and unarchive commands set the archived flag", async () => {
  let seenBody;
  const client = fakeClient({
    put: async (path, body) => {
      seenBody = body;
      assert.equal(path, "/notes/n1/archived");
      return { id: "n1", title: "T", reviewState: "Verified", updatedAt: "t", archivedAt: body.archived ? "now" : null };
    },
  });
  const archived = await makeArchiveCommand(true)(["n1"], client);
  assert.equal(seenBody.archived, true);
  assert.equal(archived.archivedAt, "now");

  const unarchived = await makeArchiveCommand(false)(["n1"], client);
  assert.equal(seenBody.archived, false);
  assert.equal(unarchived.archivedAt, null);
});

test("verifyCommand and flagOutdatedCommand hit their endpoints", async () => {
  const client = fakeClient({
    put: async (path, body) => {
      if (path.endsWith("/verify")) {
        assert.equal(body.expiresAt, "2026-12-31T00:00:00Z");
        return { id: "n1", title: "T", reviewState: "Verified", updatedAt: "t" };
      }
      if (path.endsWith("/flag-as-outdated")) {
        assert.equal(body.reason, "stale");
        return { id: "n1", title: "T", reviewState: "Outdated", updatedAt: "t" };
      }
      throw new Error("unexpected path " + path);
    },
  });
  await verifyCommand(["n1", "--expires", "2026-12-31T00:00:00Z"], client);
  await flagOutdatedCommand(["n1", "--reason", "stale"], client);
});

test("ownerCommand requires exactly one of --user/--group", async () => {
  const client = fakeClient({ put: async () => ({ id: "n1" }) });
  await assert.rejects(() => ownerCommand(["n1"], client), /--user or --group/);
  await assert.rejects(() => ownerCommand(["n1", "--user", "u1", "--group", "g1"], client), /only one/);
});

test("ownerCommand sets a user owner", async () => {
  const client = fakeClient({
    put: async (path, body) => {
      assert.equal(path, "/notes/n1/owner");
      assert.deepEqual(body.owner, { userId: "u1" });
      return { id: "n1", title: "T", reviewState: "Verified", updatedAt: "t", owner: body.owner };
    },
  });
  const result = await ownerCommand(["n1", "--user", "u1"], client);
  assert.deepEqual(result.owner, { userId: "u1" });
});
