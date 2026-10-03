import { pick } from "../format.js";

/** Content-first default view: who we are authenticated as, plus next steps. */
export async function homeCommand(_args, client) {
  const user = await client.get("/me");
  return {
    authenticatedAs: pick(user, ["id", "email", "name"]),
    help: [
      "Run `slite-axi search <query>` to find notes",
      "Run `slite-axi get <id>` to read a note",
      "Run `slite-axi --help` for the full command reference",
    ],
  };
}
