// npm run dev: builds every project, then serves the player with live reload.
import { startServer, buildAll } from "./server.ts";

const port = Number(process.env.PORT ?? 8080);
const first = await buildAll();
console.log(first.ok ? "Built all projects." : `Build failed:\n${first.output}`);
const { url } = await startServer({ port, watch: true, log: s => console.log(new Date().toLocaleTimeString(), s) });
console.log(`Scratch workbench: ${url}`);
console.log("Edit any build script, library or template; projects rebuild and open players reload.");
