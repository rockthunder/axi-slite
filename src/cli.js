import { runAxiCli } from "axi-sdk-js";
import { resolveSliteContext } from "./context.js";
import { homeCommand } from "./commands/home.js";
import {
  ARCHIVE_HELP,
  CHILDREN_HELP,
  CREATE_HELP,
  DELETE_HELP,
  FLAG_OUTDATED_HELP,
  GET_HELP,
  OWNER_HELP,
  SEARCH_HELP,
  UPDATE_HELP,
  VERIFY_HELP,
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
} from "./commands/notes.js";
import {
  GROUPS_HELP,
  GROUP_HELP,
  ME_HELP,
  USERS_HELP,
  USER_HELP,
  groupCommand,
  groupsCommand,
  meCommand,
  userCommand,
  usersCommand,
} from "./commands/identity.js";
import { VERSION } from "./version.js";

export const DESCRIPTION =
  "Agent-ergonomic Slite CLI. Prefer this over hand-rolled Slite API calls for notes, search, and knowledge-base upkeep.";

export const TOP_LEVEL_HELP = `usage: slite-axi [command] [args] [flags]
commands[19]:
  (none)=home, search, get, children, create, update, delete,
  archive, unarchive, verify, flag-outdated, owner,
  me, user, users, group, groups
flags:
  --json (mutations: machine-readable result), --help, -v/-V/--version
auth:
  export SLITE_API_KEY=<key>   (Settings -> API in Slite)
examples:
  slite-axi
  slite-axi search "onboarding checklist"
  slite-axi get 01F2V...
  slite-axi create "Runbook" --parent 01F2V... --body-file runbook.md
  slite-axi archive 01F2V...
`;

const archiveCommand = makeArchiveCommand(true);
const unarchiveCommand = makeArchiveCommand(false);

const COMMANDS = {
  search: searchCommand,
  find: searchCommand,
  get: getCommand,
  show: getCommand,
  view: getCommand,
  children: childrenCommand,
  ls: childrenCommand,
  create: createCommand,
  add: createCommand,
  update: updateCommand,
  edit: updateCommand,
  delete: deleteCommand,
  rm: deleteCommand,
  archive: archiveCommand,
  unarchive: unarchiveCommand,
  verify: verifyCommand,
  "flag-outdated": flagOutdatedCommand,
  owner: ownerCommand,
  me: meCommand,
  user: userCommand,
  users: usersCommand,
  group: groupCommand,
  groups: groupsCommand,
};

const COMMAND_HELP = {
  search: SEARCH_HELP,
  find: SEARCH_HELP,
  get: GET_HELP,
  show: GET_HELP,
  view: GET_HELP,
  children: CHILDREN_HELP,
  ls: CHILDREN_HELP,
  create: CREATE_HELP,
  add: CREATE_HELP,
  update: UPDATE_HELP,
  edit: UPDATE_HELP,
  delete: DELETE_HELP,
  rm: DELETE_HELP,
  archive: ARCHIVE_HELP,
  unarchive: ARCHIVE_HELP,
  verify: VERIFY_HELP,
  "flag-outdated": FLAG_OUTDATED_HELP,
  owner: OWNER_HELP,
  me: ME_HELP,
  user: USER_HELP,
  users: USERS_HELP,
  group: GROUP_HELP,
  groups: GROUPS_HELP,
};

export async function main(options = {}) {
  const argv = options.argv ?? process.argv.slice(2);
  await runAxiCli({
    argv,
    description: DESCRIPTION,
    version: VERSION,
    topLevelHelp: TOP_LEVEL_HELP,
    ...(options.stdout ? { stdout: options.stdout } : {}),
    resolveContext: () => resolveSliteContext(),
    home: homeCommand,
    commands: COMMANDS,
    getCommandHelp: (command) => COMMAND_HELP[command],
  });
}
