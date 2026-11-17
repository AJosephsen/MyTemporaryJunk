// Builds chain-spark.sb3, the whole tutorial game: the last step (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { chainSpark, LAST } from "./project.ts";

const sb3 = chainSpark(LAST);
writeFileSync(new URL("chain-spark.sb3", import.meta.url), sb3);
console.log(`chain-spark.sb3: ${sb3.length} bytes`);
