// Builds the Chain Spark tutorial: the checkpoints come from games/chain-spark/project.ts (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { chainSpark, LAST } from "../../games/chain-spark/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, chainSpark, ["Stage", "Firework", "Match"]);
