// Builds the Splat Patrol tutorial: the checkpoints come from games/splat-patrol/project.ts (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { splatPatrol, LAST } from "../../games/splat-patrol/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, splatPatrol, ["Stage", "Window", "Crosshair", "Goo"]);
