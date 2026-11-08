// Builds the Lantern Deep tutorial: the checkpoints come from games/lantern-deep/project.ts, so the tutorial and the
// game are the same code (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { lanternDeep, LAST } from "../../games/lantern-deep/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, lanternDeep, ["Stage", "Square", "Miner", "Pick", "Lantern", "Hud", "Crawler"]);
