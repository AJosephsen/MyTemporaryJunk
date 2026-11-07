// npm run export -- <out.html> [project.sb3 ...]
// Writes one standalone HTML page that plays the given projects (default: Dust Hopper and its tutorial
// checkpoints). The projects are embedded in the page; the TurboWarp runtime loads from the jsDelivr CDN.
// The TurboWarp compiler is switched off so the page also works where eval is not allowed.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ROOT, listProjects } from "./server.ts";

const RUNTIME = "https://cdn.jsdelivr.net/npm/@turbowarp/scaffolding@0.4.0/dist/scaffolding-min.js";
const args = process.argv.slice(2);
const out = resolve(args[0] ?? join(ROOT, "export", "player.html"));
const chosen = args.length > 1 ? args.slice(1) : listProjects().filter(p => p.includes("dust-hopper") && !p.endsWith("starter.sb3"));

const label = (p: string) => {
  const step = p.match(/step(\d+)\.sb3$/);
  if (step) return `Tutorial checkpoint, step ${step[1]}`;
  const name = p.split("/").pop()!.replace(/\.sb3$/, "").replace(/-/g, " ");
  return name.replace(/\b\w/g, c => c.toUpperCase());
};
const projects = chosen.map(p => ({ path: p, label: label(p), data: readFileSync(join(ROOT, p)).toString("base64") }));

const page = `<title>Dust Hopper Player</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Single dark arcade look, chosen on purpose: the game itself is set in space. */
:root { color-scheme: dark; --bg: #0d0e17; --panel: #171927; --line: #2b2e44; --fg: #eceaf6; --muted: #a3a1bd;
  --go: #59d36a; --stop: #f06464; --accent: #e8833a; --key: #22253a; }
body { background: var(--bg); color: var(--fg); font: 15px/1.45 system-ui, "Segoe UI", sans-serif;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 16px 32px; }
.wrap { max-width: 760px; margin: 0 auto; display: grid; gap: 12px; }
.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
h1 { font-size: 1.15rem; margin: 0 auto 0 0; letter-spacing: 0.02em; }
select, button { font: inherit; color: var(--fg); background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px 12px; }
select { min-width: 0; max-width: 100%; }
button { cursor: pointer; touch-action: manipulation; }
button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
#go { color: var(--go); border-color: var(--go); font-weight: 600; }
#stop { color: var(--stop); border-color: var(--stop); }
#stage { width: 100%; aspect-ratio: 4 / 3; background: #000; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
#status { color: var(--muted); font-size: 0.9rem; min-height: 1.3em; }
.pad { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.pad button { background: var(--key); padding: 14px 4px; font-size: 1rem; user-select: none; -webkit-user-select: none; }
.pad button.down { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.help { color: var(--muted); font-size: 0.9rem; margin: 0; }
kbd { font: 0.85em ui-monospace, monospace; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; padding: 0 5px; }
</style>
<div class="wrap">
  <div class="bar">
    <h1>Dust Hopper</h1>
    <select id="project" aria-label="Project"></select>
    <button id="go" type="button">Green flag</button>
    <button id="stop" type="button">Stop</button>
  </div>
  <div id="stage" tabindex="0" aria-label="Game stage"></div>
  <div id="status">Loading the Scratch runtime…</div>
  <div class="pad" aria-label="On-screen keys">
    <button type="button" data-key="ArrowLeft" aria-label="Tilt left">◀</button>
    <button type="button" data-key="ArrowUp" aria-label="Throttle up">▲</button>
    <button type="button" data-key="ArrowDown" aria-label="Throttle down">▼</button>
    <button type="button" data-key="ArrowRight" aria-label="Tilt right">▶</button>
    <button type="button" data-key=" " aria-label="Boost">Boost</button>
  </div>
  <p class="help">Click the stage, then use <kbd>↑</kbd> <kbd>↓</kbd> for throttle, <kbd>←</kbd> <kbd>→</kbd> to tilt and <kbd>Space</kbd> to boost. On a touch screen, hold the buttons. Land gently on a yellow pad.</p>
</div>
<script src="${RUNTIME}"></script>
<script>
const PROJECTS = ${JSON.stringify(projects)};
const $ = id => document.getElementById(id);
const status = t => { $("status").textContent = t; };
try {
  const scaffolding = new Scaffolding.Scaffolding();
  scaffolding.width = 480; scaffolding.height = 360;
  scaffolding.resizeMode = "preserve-ratio";
  scaffolding.shouldConnectPeripherals = false;
  scaffolding.setup();
  scaffolding.appendTo($("stage"));
  const vm = scaffolding.vm;
  vm.setCompilerOptions({ enabled: false });
  const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  for (const [i, p] of PROJECTS.entries()) $("project").add(new Option(p.label, String(i)));
  const open = async i => {
    status("Loading " + PROJECTS[i].label + "…");
    await scaffolding.loadProject(bytes(PROJECTS[i].data));
    status(PROJECTS[i].label + ": click Green flag to play.");
  };
  $("project").addEventListener("change", () => open(Number($("project").value)));
  $("go").addEventListener("click", () => { scaffolding.greenFlag(); status("Running. Click the stage for keyboard control."); $("stage").focus(); });
  $("stop").addEventListener("click", () => { scaffolding.stopAll(); status("Stopped."); });
  for (const b of document.querySelectorAll(".pad button")) {
    const press = down => { b.classList.toggle("down", down); vm.postIOData("keyboard", { key: b.dataset.key, isDown: down }); };
    b.addEventListener("pointerdown", e => { e.preventDefault(); b.setPointerCapture(e.pointerId); press(true); });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, () => press(false));
  }
  open(0).catch(e => status("Could not load the project: " + e.message));
} catch (e) {
  status("The Scratch runtime could not start here: " + e.message);
}
</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`${out}: ${projects.length} projects, ${(page.length / 1024).toFixed(0)} KB`);
