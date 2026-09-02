/*
 * Copy the shared challenge logic into the leaderboard Worker.
 *
 * The Worker has to rebuild the very challenge the game dealt and score it the
 * same way. Mirroring that arithmetic by hand is how honest scores get quietly
 * rejected, so there is one file and this copies it. The Worker's suite hashes
 * its copy and fails if it no longer matches, which is what makes forgetting
 * to run this loud rather than silent.
 *
 *   npm run sync:arcade
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve(process.cwd(), "src/lib/challenges.mjs");
const target = resolve(process.cwd(), "../../arcade-api/src/challenges.mjs");

if (!existsSync(resolve(process.cwd(), "../../arcade-api"))) {
  console.log("arcade-api is not checked out beside this repo — nothing to sync.");
  process.exit(0);
}

copyFileSync(source, target);
const hash = createHash("sha256").update(readFileSync(source)).digest("hex").slice(0, 16);
writeFileSync(resolve(target, "../challenges.hash"), `${hash}\n`);
console.log(`synced challenges.mjs → arcade-api (${hash})`);
