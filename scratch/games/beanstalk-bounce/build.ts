// Builds beanstalk-bounce.sb3, the whole game: the last step of the tutorial (see project.ts).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { beanstalkBounce, LAST } from "./project.ts";

const sb3 = beanstalkBounce(LAST);
writeFileSync(new URL("beanstalk-bounce.sb3", import.meta.url), sb3);
console.log(`beanstalk-bounce.sb3: ${sb3.length} bytes`);
