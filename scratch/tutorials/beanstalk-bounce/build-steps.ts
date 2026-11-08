// Builds the Beanstalk Bounce tutorial: the checkpoints come from games/beanstalk-bounce/project.ts, so the tutorial
// and the game are the same code (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { beanstalkBounce, LAST } from "../../games/beanstalk-bounce/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, beanstalkBounce, ["Stage", "Frog", "Skin", "Leaf", "Bee"]);
