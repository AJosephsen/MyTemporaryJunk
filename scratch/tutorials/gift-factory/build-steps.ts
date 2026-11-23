// Builds the Gift Factory tutorial: the checkpoints come from games/gift-factory/project.ts (the game is the last step).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { buildTutorial } from "../../lib/tutorial.ts";
import { giftFactory, LAST } from "../../games/gift-factory/project.ts";

buildTutorial(new URL(".", import.meta.url), LAST, giftFactory, ["Belt", "Gift", "Basket"]);
