// Builds slime-siege.sb3, the whole tutorial game: the last step (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { slimeSiege, LAST } from "./project.ts";

const sb3 = slimeSiege(LAST);
writeFileSync(new URL("slime-siege.sb3", import.meta.url), sb3);
console.log(`slime-siege.sb3: ${sb3.length} bytes`);
