// npm run export:game -- <game folder> [out.html]
// Writes a standalone, published-ready page for one finished game, described by <game folder>/page.json:
// title, tagline, project file, on-screen buttons (left and right) and a keyboard hint.
// Landscape: stage at full height, buttons at the sides. Portrait: stage on top, buttons below.
// Includes a full-screen button (real full screen where allowed, otherwise fills the window).
// The project is embedded; the TurboWarp runtime loads from jsDelivr; the compiler is off (no eval needed).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { ROOT } from "./server.ts";

type Button = { key: string; label: string; name: string; big?: boolean };
type PageSpec = { title: string; tagline: string; project: string; left: Button[]; right: Button[]; keys: string };

const RUNTIME = "https://cdn.jsdelivr.net/npm/@turbowarp/scaffolding@0.4.0/dist/scaffolding-min.js";
const folder = resolve(ROOT, process.argv[2] ?? "games/dust-hopper");
const spec: PageSpec = JSON.parse(readFileSync(join(folder, "page.json"), "utf8"));
const out = resolve(process.argv[3] ?? join(ROOT, "export", `${basename(folder)}.html`));
const data = readFileSync(join(folder, spec.project)).toString("base64");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const buttons = (list: Button[]) => list.map(b =>
  `<button type="button" class="key${b.big ? " big" : ""}" data-key="${esc(b.key)}" aria-label="${esc(b.name)}">${esc(b.label)}</button>`).join("");

const page = `<title>${esc(spec.title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap">
<style>
/* One dark look on purpose: the game is set in space. Layout: side columns in landscape, stacked in portrait. */
:root { color-scheme: dark; --bg: #090a12; --panel: #141626; --line: #2a2d45; --fg: #eeecf8; --muted: #9c9ab8;
  --accent: #e8833a; --go: #59d36a; --key: #1d2035; --side: clamp(96px, 16vw, 190px);
  --display: "Fredoka", "Trebuchet MS", system-ui, sans-serif; }
html, body { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.4 system-ui, "Segoe UI", sans-serif; overflow: hidden; }
.app { position: relative; height: 100%; display: grid; gap: 10px; box-sizing: border-box; background: var(--bg);
  padding-left: max(12px, env(safe-area-inset-left, 0px)); padding-right: max(12px, env(safe-area-inset-right, 0px));
  padding-block: max(10px, env(safe-area-inset-top, 0px)) max(10px, env(safe-area-inset-bottom, 0px));
  grid-template-columns: var(--side) minmax(0, 1fr) var(--side); grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: "brand stage tools" "padl stage padr"; }
.app.window { position: fixed; inset: 0; z-index: 100; }
.brand { grid-area: brand; display: grid; gap: 6px; align-content: start; min-width: 0; }
.tools { grid-area: tools; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.padl { grid-area: padl; } .padr { grid-area: padr; }
.padl, .padr { display: grid; gap: 10px; align-content: end; min-width: 0; }
.padl { grid-template-columns: 1fr 1fr; }
h1 { font: 600 clamp(1.1rem, 2.6vw, 1.6rem)/1.1 var(--display); margin: 0; letter-spacing: 0.01em; }
.tagline { color: var(--muted); font-size: 0.85rem; margin: 0; }
.hint { color: var(--muted); font-size: 0.8rem; margin: 0; }
.stagebox { grid-area: stage; container-type: size; display: grid; place-items: center; min-width: 0; min-height: 0; }
.stagewrap { position: relative; width: min(100cqw, 100cqh * 4 / 3); aspect-ratio: 4 / 3; }
#stage { width: 100%; height: 100%; background: #000; border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
  touch-action: none; /* finger drags on the stage act as the mouse instead of scrolling the page */ }
button { font: inherit; color: var(--fg); background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
  padding: 7px 12px; cursor: pointer; touch-action: manipulation; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.key { background: var(--key); font: 600 1.05rem var(--display); min-height: 54px; padding: 0 6px;
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.key.big { min-height: 96px; font-size: 1.25rem; }
.padr .key.big { border-color: var(--accent); }
.key.down { background: var(--accent); border-color: var(--accent); color: var(--bg); }
#play { position: absolute; inset: 0; margin: auto; width: max-content; height: max-content; font: 600 1.4rem var(--display);
  padding: 14px 34px; border-radius: 999px; background: var(--go); color: #0b1a0d; border: 0; box-shadow: 0 8px 30px rgb(0 0 0 / 45%); }
#restart { align-self: start; }
@media (orientation: portrait) {
  .app { grid-template-columns: 1fr 1fr; grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "brand tools" "stage stage" "padl padr"; }
  .stagebox { container-type: inline-size; }
  .stagewrap { width: 100cqw; }
  .padl, .padr { align-content: end; }
  .tools { flex-direction: row; align-items: flex-start; justify-content: flex-end; }
}
/* Full screen: the stage fills the screen and the controls float over it. */
.app.immersive { display: block; padding: 0; background: #000; }
.immersive .stagebox { position: absolute; inset: 0; container-type: size; }
.immersive .stagewrap { width: min(100cqw, 100cqh * 4 / 3); }
.immersive #stage { border: 0; border-radius: 0; }
.immersive .brand h1, .immersive .tagline, .immersive .hint { display: none; }
.immersive .brand, .immersive .tools, .immersive .padl, .immersive .padr { position: absolute; z-index: 2; }
.immersive .brand { top: max(10px, env(safe-area-inset-top, 0px)); left: max(10px, env(safe-area-inset-left, 0px)); }
.immersive .tools { top: max(10px, env(safe-area-inset-top, 0px)); right: max(10px, env(safe-area-inset-right, 0px)); }
.immersive .padl { bottom: max(14px, env(safe-area-inset-bottom, 0px)); left: max(14px, env(safe-area-inset-left, 0px)); width: clamp(120px, 20vw, 210px); }
.immersive .padr { bottom: max(14px, env(safe-area-inset-bottom, 0px)); right: max(14px, env(safe-area-inset-right, 0px)); width: clamp(100px, 16vw, 180px); }
.immersive .brand button, .immersive .tools button, .immersive .key {
  background: rgb(20 22 38 / 42%); border-color: rgb(255 255 255 / 22%); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.immersive .key.down { background: rgb(232 131 58 / 75%); border-color: var(--accent); }
.immersive .brand button, .immersive .tools button { padding: 5px 10px; font-size: 0.85rem; }
@media (pointer: fine) { .key { min-height: 44px; } .key.big { min-height: 64px; } }
@media (pointer: coarse) { .hint { display: none; } }
@media (prefers-reduced-motion: no-preference) { .key { transition: background 80ms; } }
</style>
<div class="app" id="app">
  <div class="brand">
    <h1>${esc(spec.title)}</h1>
    <p class="tagline">${esc(spec.tagline)}</p>
    <button type="button" id="restart" hidden>Restart</button>
  </div>
  <div class="tools">
    <button type="button" id="fullscreen" aria-pressed="false">Full screen</button>
  </div>
  <div class="stagebox">
    <div class="stagewrap">
      <div id="stage" tabindex="0" aria-label="Game"></div>
      <button type="button" id="play">Loading…</button>
    </div>
  </div>
  <div class="padl" aria-label="Controls">${buttons(spec.left)}<p class="hint" style="grid-column: 1 / -1">${esc(spec.keys)}</p></div>
  <div class="padr" aria-label="Controls">${buttons(spec.right)}</div>
</div>
<script src="${RUNTIME}"></script>
<script>
const $ = id => document.getElementById(id);
const play = $("play"), app = $("app");
let scaffolding = null;
try {
  scaffolding = new Scaffolding.Scaffolding();
  scaffolding.width = 480; scaffolding.height = 360;
  scaffolding.resizeMode = "preserve-ratio";
  scaffolding.shouldConnectPeripherals = false;
  scaffolding.setup();
  scaffolding.appendTo($("stage"));
  scaffolding.vm.setCompilerOptions({ enabled: false });
  window.game = scaffolding;
  const bytes = Uint8Array.from(atob("${data}"), c => c.charCodeAt(0));
  scaffolding.loadProject(bytes).then(() => { play.textContent = "Play"; play.disabled = false; },
    e => { play.textContent = "Could not load the game"; console.error(e); });
  play.disabled = true;
} catch (e) {
  play.textContent = "The game cannot start here";
  console.error(e);
}
const start = () => {
  if (!scaffolding || play.disabled) return;
  scaffolding.greenFlag();
  play.hidden = true;
  $("restart").hidden = false;
  $("stage").focus();
};
play.addEventListener("click", start);
$("restart").addEventListener("click", start);

// On-screen keys: pressed while held, released when the finger or mouse lets go or slides off.
for (const b of document.querySelectorAll(".key")) {
  const press = down => {
    if (b.classList.contains("down") === down) return;
    b.classList.toggle("down", down);
    scaffolding?.vm.postIOData("keyboard", { key: b.dataset.key, isDown: down });
  };
  b.addEventListener("pointerdown", e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); press(true); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, () => press(false));
  b.addEventListener("contextmenu", e => e.preventDefault());
  // The Scratch player follows the mouse and touches across the whole page. Keep the buttons' own touches and
  // mouse movements away from it, or pressing a button would also count as moving the mouse to the button.
  for (const ev of ["mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend", "touchcancel"])
    b.addEventListener(ev, e => e.stopPropagation());
}

// Full screen: real full screen where the browser allows it, otherwise fill the window.
const fsButton = $("fullscreen");
const setLabel = on => {
  fsButton.textContent = on ? "Exit full screen" : "Full screen";
  fsButton.setAttribute("aria-pressed", String(on));
  app.classList.toggle("immersive", on);
};
const relayout = () => requestAnimationFrame(() => scaffolding?.relayout());
fsButton.addEventListener("click", async () => {
  if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return; }
  if (app.classList.contains("window")) { app.classList.remove("window"); setLabel(false); relayout(); return; }
  try {
    if (!app.requestFullscreen) throw new Error("no full screen");
    await app.requestFullscreen({ navigationUI: "hide" });
    screen.orientation?.lock?.("landscape").catch(() => {});
  } catch {
    app.classList.add("window");
    setLabel(true);
    relayout();
  }
});
document.addEventListener("fullscreenchange", () => { setLabel(!!document.fullscreenElement); relayout(); });
addEventListener("resize", relayout);
addEventListener("orientationchange", relayout);
</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024).toFixed(0)} KB`);
