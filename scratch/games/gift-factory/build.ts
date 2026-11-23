// Builds gift-factory.sb3, the whole tutorial game: the last step (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { giftFactory, LAST } from "./project.ts";

const sb3 = giftFactory(LAST);
writeFileSync(new URL("gift-factory.sb3", import.meta.url), sb3);
console.log(`gift-factory.sb3: ${sb3.length} bytes`);
