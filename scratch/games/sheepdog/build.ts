// Builds sheepdog.sb3, the whole game: the last step of the tutorial (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { sheepdog, LAST } from "./project.ts";

const sb3 = sheepdog(LAST);
writeFileSync(new URL("sheepdog.sb3", import.meta.url), sb3);
console.log(`sheepdog.sb3: ${sb3.length} bytes`);
