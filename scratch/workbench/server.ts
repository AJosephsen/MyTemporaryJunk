// Local workbench server: serves the player page, the project files and the TurboWarp runtime.
// With watch: true it rebuilds projects when sources change and tells open players to reload.
import http from "node:http";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, watch, existsSync } from "node:fs";
import { join, relative, dirname, extname, resolve, sep } from "node:path";

export const ROOT = resolve(new URL("..", import.meta.url).pathname);
const HERE = resolve(new URL(".", import.meta.url).pathname);
const RUNTIME = join(ROOT, "node_modules", "@turbowarp", "scaffolding", "dist");
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const BUILD_SCRIPTS = new Set(["build.ts", "build-steps.ts"]);
// Files written by builds; changes to them must not trigger another build.
const GENERATED = [/\.sb3$/, /\.png$/, /(^|\/)index\.html$/, /(^|\/)blocks\.json$/];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

export const listProjects = () =>
  walk(ROOT).filter(p => p.endsWith(".sb3")).map(p => relative(ROOT, p).split(sep).join("/")).sort();

export const listBuildScripts = () =>
  walk(ROOT).filter(p => BUILD_SCRIPTS.has(p.split(sep).pop()!) && !p.startsWith(HERE)).sort();

const hashAll = () => Object.fromEntries(listProjects().map(p =>
  [p, createHash("md5").update(readFileSync(join(ROOT, p))).digest("hex")]));

// Runs every build script in turn. Returns the projects whose files changed.
export async function buildAll(): Promise<{ ok: boolean; output: string; changed: string[] }> {
  const before = hashAll();
  let ok = true, output = "";
  for (const script of listBuildScripts()) {
    const res = await new Promise<{ code: number; text: string }>(done =>
      execFile(process.execPath, ["--experimental-strip-types", "--no-warnings", script], { cwd: dirname(script) },
        (err, stdout, stderr) => done({ code: err ? 1 : 0, text: stdout + stderr })));
    output += `$ ${relative(ROOT, script)}\n${res.text}`;
    if (res.code) { ok = false; break; }
  }
  const after = hashAll();
  const changed = Object.keys(after).filter(p => before[p] !== after[p]);
  return { ok, output, changed };
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".sb3": "application/octet-stream", ".map": "application/json",
};

function send(res: http.ServerResponse, file: string) {
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(file));
}

export async function startServer(opts: { port?: number; watch?: boolean; log?: (s: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const clients = new Set<http.ServerResponse>();
  const broadcast = (msg: object) => { for (const c of clients) c.write(`data: ${JSON.stringify(msg)}\n\n`); };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = decodeURIComponent(url.pathname);
    if (path === "/") return send(res, join(HERE, "player.html"));
    if (path === "/player.js") return send(res, join(HERE, "player.js"));
    if (path === "/api/projects") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(listProjects()));
      return;
    }
    if (path.startsWith("/project/")) {
      const file = resolve(ROOT, path.slice("/project/".length));
      if (!file.startsWith(ROOT + sep) || !file.endsWith(".sb3")) { res.writeHead(403).end(); return; }
      return send(res, file);
    }
    if (path === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(`data: ${JSON.stringify({ type: "hello", watching: !!opts.watch })}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    // TurboWarp runtime files (scaffolding bundle and its worker).
    const runtimeFile = resolve(RUNTIME, "." + path);
    if (runtimeFile.startsWith(RUNTIME + sep)) return send(res, runtimeFile);
    res.writeHead(404).end("not found");
  });

  if (opts.watch) {
    let timer: NodeJS.Timeout | undefined, building = false, again = false;
    const rebuild = async () => {
      if (building) { again = true; return; }
      building = true;
      broadcast({ type: "building" });
      const result = await buildAll();
      log(result.ok ? `rebuilt: ${result.changed.length ? result.changed.join(", ") : "no project changed"}` : `build failed\n${result.output}`);
      broadcast({ type: "rebuilt", ...result });
      building = false;
      if (again) { again = false; rebuild(); }
    };
    watch(ROOT, { recursive: true }, (_event, name) => {
      if (!name) return;
      const rel = name.split(sep).join("/");
      if (rel.split("/").some(part => SKIP_DIRS.has(part)) || GENERATED.some(r => r.test(rel))) return;
      if (!/\.(ts|html|json|svg|csv|txt)$/.test(rel)) return;
      clearTimeout(timer);
      timer = setTimeout(rebuild, 200);
    });
  }

  await new Promise<void>(done => server.listen(opts.port ?? 0, "127.0.0.1", done));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>(done => { for (const c of clients) c.end(); server.close(() => done()); }),
  };
}
