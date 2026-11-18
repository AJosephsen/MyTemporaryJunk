// Builds the Boom Lab tutorial: the checkpoints come from games/boom-lab/project.ts (the lab is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { boomLab, LAST } from "../../games/boom-lab/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, boomLab, ["Land", "Boom", "Flash", "Button"]);
