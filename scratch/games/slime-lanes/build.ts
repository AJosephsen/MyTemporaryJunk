// Builds slime-lanes.sb3, the whole tutorial game: the last step (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { slimeLanes, LAST } from "./project.ts";

const sb3 = slimeLanes(LAST);
writeFileSync(new URL("slime-lanes.sb3", import.meta.url), sb3);
console.log(`slime-lanes.sb3: ${sb3.length} bytes`);
