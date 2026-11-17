// Builds chimney-drop.sb3, the whole game: the last step of the tutorial (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { chimneyDrop, LAST } from "./project.ts";

const sb3 = chimneyDrop(LAST);
writeFileSync(new URL("chimney-drop.sb3", import.meta.url), sb3);
console.log(`chimney-drop.sb3: ${sb3.length} bytes`);
