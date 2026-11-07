// npm run build: runs every build script under games/ and tutorials/.
import { buildAll } from "./server.ts";

const result = await buildAll();
console.log(result.output.trim());
console.log(result.ok ? `\nOK. Changed: ${result.changed.length ? result.changed.join(", ") : "none"}` : "\nBuild failed.");
process.exit(result.ok ? 0 : 1);
