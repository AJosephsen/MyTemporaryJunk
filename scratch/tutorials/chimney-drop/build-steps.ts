// Builds the Chimney Drop tutorial: the checkpoints come from games/chimney-drop/project.ts (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { chimneyDrop, LAST } from "../../games/chimney-drop/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, chimneyDrop, ["Sleigh", "House", "Chimney", "Present", "Snow"]);
