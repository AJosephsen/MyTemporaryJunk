// Builds the Slime Siege tutorial: the checkpoints come from games/slime-siege/project.ts (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { slimeSiege, LAST } from "../../games/slime-siege/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, slimeSiege, ["Keep", "Slime", "Tower", "Tool", "Ring"]);
