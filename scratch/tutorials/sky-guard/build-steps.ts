// Builds the Sky Guard tutorial: the checkpoints come from games/sky-guard/project.ts (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { skyGuard, LAST } from "../../games/sky-guard/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, skyGuard, ["Stage", "Cannon", "Bullet", "Meteor"]);
