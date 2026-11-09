// Builds sky-guard.sb3, the whole game: the last step of the tutorial (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { skyGuard, LAST } from "./project.ts";

const sb3 = skyGuard(LAST);
writeFileSync(new URL("sky-guard.sb3", import.meta.url), sb3);
console.log(`sky-guard.sb3: ${sb3.length} bytes`);
