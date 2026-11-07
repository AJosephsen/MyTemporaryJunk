// npm run export:runner -- <tutorial folder>
// Writes export/<name>-runner.html: one page that runs every checkpoint of a tutorial (step1.sb3, step2.sb3, ...)
// and shows the scripts of the chosen step next to the stage. Needs the tutorial's generated blocks.json and a
// runner.json with the page title, help text and a name and note per step. The projects are embedded in the page;
// the TurboWarp runtime and scratchblocks load from jsDelivr. The compiler is off, as on scratch.mit.edu.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { ROOT } from "./server.ts";

const RUNTIME = "https://cdn.jsdelivr.net/npm/@turbowarp/scaffolding@0.4.0/dist/scaffolding-min.js";
const BLOCKS = "https://cdn.jsdelivr.net/npm/scratchblocks@3.6.4/build/scratchblocks.min.js";
const dir = resolve(ROOT, process.argv[2] ?? "");
const cfg = JSON.parse(readFileSync(join(dir, "runner.json"), "utf8"));
const blockText: Record<string, string> = JSON.parse(readFileSync(join(dir, "blocks.json"), "utf8"));
const steps = readdirSync(dir).map(f => f.match(/^step(\d+)\.sb3$/)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const projects = steps.map(n => {
  const scripts = Object.entries(blockText).filter(([k]) => k.startsWith(`${n}:`))
    .map(([k, text]) => `<div class="panel"><div class="label">${esc(k.split(":")[1])}</div><pre class="blocks">${esc(text)}</pre></div>`).join("");
  const s = cfg.steps[String(n)] ?? {};
  return { n, name: s.name ?? `Step ${n}`, note: s.note ?? "", scripts,
    data: readFileSync(join(dir, `step${n}.sb3`)).toString("base64") };
});

const page = `<title>${esc(cfg.title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: the stage and step picker on top (left on wide screens), the step's scripts below (right on wide screens). */
:root { --bg: #f4efe6; --surface: #ffffff; --fg: #2a1d14; --muted: #6e5d50; --line: #e2d6c5; --accent: #8a4a1c;
  --accent-fg: #ffffff; --go: #2f8f3a; --stop: #c43c3c; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #17110c; --surface: #221a13; --fg: #f1e7da;
  --muted: #b8a796; --line: #3a2d22; --accent: #f2c27a; --accent-fg: #17110c; --go: #6fd27b; --stop: #f07a7a; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #17110c; --surface: #221a13; --fg: #f1e7da; --muted: #b8a796; --line: #3a2d22;
  --accent: #f2c27a; --accent-fg: #17110c; --go: #6fd27b; --stop: #f07a7a; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, "Segoe UI", sans-serif;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 16px 32px; }
.wrap { max-width: 1180px; margin: 0 auto; display: grid; gap: 16px; }
@media (min-width: 1000px) { .wrap { grid-template-columns: minmax(0, 560px) minmax(0, 1fr); align-items: start; } }
.left, .right { display: grid; gap: 12px; min-width: 0; }
h1 { font-size: 1.3rem; margin: 0; }
.steps { display: flex; flex-wrap: wrap; gap: 6px; }
.steps button, .bar button { font: inherit; border-radius: 6px; padding: 6px 12px; cursor: pointer; border: 1px solid var(--line);
  background: var(--surface); color: var(--fg); touch-action: manipulation; }
.steps button[aria-pressed="true"] { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); font-weight: 600; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
#go { color: var(--go); border-color: var(--go); font-weight: 600; }
#stop { color: var(--stop); border-color: var(--stop); }
#status { color: var(--muted); font-size: 0.9rem; }
#stage { width: 100%; aspect-ratio: 4 / 3; background: #000; border-radius: 8px; overflow: hidden; }
.note { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; margin: 0; }
.note b { color: var(--accent); }
.help { color: var(--muted); font-size: 0.9rem; margin: 0; }
.panel { background: #ffffff; border: 1px solid var(--line); border-radius: 8px; padding: 12px; overflow-x: auto; }
.panel .label { font: 700 0.75rem system-ui, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: #6e5d50; margin-bottom: 6px; }
pre.blocks { margin: 0; font: 12px ui-monospace, monospace; white-space: pre; color: #2a1d14; }
#scripts { display: grid; gap: 10px; }
</style>
<div class="wrap">
  <div class="left">
    <h1>${esc(cfg.heading)}</h1>
    <div class="steps" role="group" aria-label="Steps">${projects.map((p, i) =>
      `<button type="button" data-i="${i}" aria-pressed="${i === 0}">${p.n}. ${esc(p.name)}</button>`).join("")}</div>
    <div id="stage" aria-label="Stage"></div>
    <div class="bar"><button id="go" type="button">Green flag</button><button id="stop" type="button">Stop</button>
      <span id="status">Loading the Scratch runtime…</span></div>
    <p class="help">${esc(cfg.help)}</p>
  </div>
  <div class="right">
    <p class="note" id="note"></p>
    <div id="scripts"></div>
  </div>
</div>
<script src="${RUNTIME}"></script>
<script src="${BLOCKS}"></script>
<script>
const PROJECTS = ${JSON.stringify(projects)};
const $ = id => document.getElementById(id);
const status = t => { $("status").textContent = t; };
const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
try {
  const scaffolding = new Scaffolding.Scaffolding();
  scaffolding.width = 480; scaffolding.height = 360;
  scaffolding.resizeMode = "preserve-ratio";
  scaffolding.shouldConnectPeripherals = false;
  scaffolding.setup();
  scaffolding.appendTo($("stage"));
  scaffolding.vm.setCompilerOptions({ enabled: false });
  const open = async i => {
    const p = PROJECTS[i];
    for (const b of document.querySelectorAll(".steps button")) b.setAttribute("aria-pressed", String(b.dataset.i === String(i)));
    $("note").innerHTML = "<b>Step " + p.n + ": " + p.name.replace(/</g, "&lt;") + ".</b> " + p.note.replace(/</g, "&lt;");
    $("scripts").innerHTML = p.scripts;
    if (window.scratchblocks) scratchblocks.renderMatching("#scripts pre.blocks", { style: "scratch3", languages: ["en"], scale: 0.7 });
    status("Loading…");
    await scaffolding.loadProject(bytes(p.data));
    status("Ready: click Green flag.");
  };
  for (const b of document.querySelectorAll(".steps button")) b.addEventListener("click", () => open(Number(b.dataset.i)));
  $("go").addEventListener("click", () => { scaffolding.greenFlag(); status("Running."); });
  $("stop").addEventListener("click", () => { scaffolding.stopAll(); status("Stopped."); });
  open(0).catch(e => status("Could not load the project: " + e.message));
} catch (e) {
  status("The Scratch runtime could not start here: " + e.message);
}
</script>
`;
const out = join(ROOT, "export", `${basename(dir)}-runner.html`);
mkdirSync(join(ROOT, "export"), { recursive: true });
writeFileSync(out, page);
console.log(`${out}: ${projects.length} steps, ${(page.length / 1024).toFixed(0)} KB`);
