import { ensureNoUnknownFlags, requirePositional, takeFlag } from "../args.js";
import { pick } from "../format.js";

export const ME_HELP = `usage: slite-axi me
Shows the authenticated user tied to SLITE_API_KEY.`;

export async function meCommand(args, client) {
  ensureNoUnknownFlags(args);
  const user = await client.get("/me");
  return pick(user, ["id", "email", "name", "username"]);
}

export const USER_HELP = `usage: slite-axi user <id>
examples:
  slite-axi user 01U8X...`;

export async function userCommand(args, client) {
  const id = requirePositional(args, 0, "user id");
  ensureNoUnknownFlags(args.slice(1));
  const user = await client.get(`/users/${encodeURIComponent(id)}`);
  return pick(user, ["id", "email", "name", "username"]);
}

export const USERS_HELP = `usage: slite-axi users <query>
flags:
  --email <email>   exact email lookup instead of a fuzzy name/username query
examples:
  slite-axi users "jane"
  slite-axi users --email jane@example.com`;

export async function usersCommand(args, client) {
  const flags = [...args];
  const query = flags[0] && !flags[0].startsWith("-") ? flags.shift() : undefined;
  const email = takeFlag(flags, "--email");
  ensureNoUnknownFlags(flags);

  const result = await client.get("/users", { query: { query, email } });
  const users = (Array.isArray(result) ? result : result.users ?? []).map((u) =>
    pick(u, ["id", "email", "name", "username"]),
  );
  return {
    users,
    total: users.length,
    help: users.length === 0 ? ["0 results"] : undefined,
  };
}

export const GROUP_HELP = `usage: slite-axi group <id>
examples:
  slite-axi group 01G7Z...`;

export async function groupCommand(args, client) {
  const id = requirePositional(args, 0, "group id");
  ensureNoUnknownFlags(args.slice(1));
  const group = await client.get(`/groups/${encodeURIComponent(id)}`);
  return pick(group, ["id", "name"]);
}

export const GROUPS_HELP = `usage: slite-axi groups <query>
examples:
  slite-axi groups "engineering"`;

export async function groupsCommand(args, client) {
  const flags = [...args];
  const query = flags[0] && !flags[0].startsWith("-") ? flags.shift() : undefined;
  ensureNoUnknownFlags(flags);

  const result = await client.get("/groups", { query: { query } });
  const groups = (Array.isArray(result) ? result : result.groups ?? []).map((g) =>
    pick(g, ["id", "name"]),
  );
  return {
    groups,
    total: groups.length,
    help: groups.length === 0 ? ["0 results"] : undefined,
  };
}
