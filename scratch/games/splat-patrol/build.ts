// Builds splat-patrol.sb3 (the game the tutorial teaches, its last step) and splat-patrol-deluxe.sb3 (the bonus
// level with disguises, particles and other extras). See project.ts.
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { splatPatrol, LAST, DELUXE } from "./project.ts";

for (const [name, step] of [["splat-patrol", LAST], ["splat-patrol-deluxe", DELUXE]] as const) {
  const sb3 = splatPatrol(step);
  writeFileSync(new URL(`${name}.sb3`, import.meta.url), sb3);
  console.log(`${name}.sb3: ${sb3.length} bytes`);
}
