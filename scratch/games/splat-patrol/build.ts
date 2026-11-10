// Builds splat-patrol.sb3, the whole game: the last step of the tutorial (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { splatPatrol, LAST } from "./project.ts";

const sb3 = splatPatrol(LAST);
writeFileSync(new URL("splat-patrol.sb3", import.meta.url), sb3);
console.log(`splat-patrol.sb3: ${sb3.length} bytes`);
