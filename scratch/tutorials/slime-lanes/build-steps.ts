// Builds the Slime Lanes tutorial: the checkpoints come from games/slime-lanes/project.ts (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { slimeLanes, LAST } from "../../games/slime-lanes/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, slimeLanes, ["Slime", "Tower", "Tool", "Ring"]);
