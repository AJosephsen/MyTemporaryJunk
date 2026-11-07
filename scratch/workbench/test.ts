// npm test [-- <name filter>] [--verbose]: runs every tests/*.test.ts headlessly.
import { readdirSync } from "node:fs";
import { run } from "./testing.ts";

const dir = new URL("../tests/", import.meta.url);
const args = process.argv.slice(2);
for (const file of readdirSync(dir).filter(f => f.endsWith(".test.ts")).sort()) await import(new URL(file, dir).href);
const ok = await run({ filter: args.find(a => !a.startsWith("--")), verbose: args.includes("--verbose") });
process.exit(ok ? 0 : 1);
