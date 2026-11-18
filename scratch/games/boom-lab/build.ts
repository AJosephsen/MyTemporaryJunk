// Builds boom-lab.sb3, the whole tutorial lab: the last step (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { boomLab, LAST } from "./project.ts";

const sb3 = boomLab(LAST);
writeFileSync(new URL("boom-lab.sb3", import.meta.url), sb3);
console.log(`boom-lab.sb3: ${sb3.length} bytes`);
