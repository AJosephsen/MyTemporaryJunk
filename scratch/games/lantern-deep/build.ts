// Builds lantern-deep.sb3, the whole game: the last step of the tutorial (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { lanternDeep, LAST } from "./project.ts";

const sb3 = lanternDeep(LAST);
writeFileSync(new URL("lantern-deep.sb3", import.meta.url), sb3);
console.log(`lantern-deep.sb3: ${sb3.length} bytes`);
