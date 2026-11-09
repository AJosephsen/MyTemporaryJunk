// Builds the Sheepdog tutorial: the checkpoints come from games/sheepdog/project.ts (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { sheepdog, LAST } from "../../games/sheepdog/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, sheepdog, ["Stage", "Dog", "Sheep", "Pen"]);
