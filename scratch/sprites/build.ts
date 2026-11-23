// Builds the effect sprites (sprites/effects/*.sprite3) and a demo project with all of them (sprites/effects-demo.sb3).
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { Project, Blocks, dsl } from "../lib/sb3.ts";
import { art } from "../games/boom-lab/art.ts";
import { effects, FX_X, FX_Y, SOUNDS } from "./effects.ts";
import { wav } from "../lib/sound.ts";
import { FX_TEXT } from "./text-effects.ts";

export const SAMPLES = ["+100", "+25", "Nice!", "COMBO x3", "Level up!", "KAPOW!", "Great!", "+1 life"];

export const fileName = (name: string) => name.toLowerCase().replace(/\s+/g, "-") + ".sprite3";

const P = new Project();
const list = effects(P);
mkdirSync(new URL("effects/", import.meta.url), { recursive: true });
for (const fx of list) {
  const file = fx.file();
  writeFileSync(new URL(`effects/${fileName(fx.name)}`, import.meta.url), file);
  console.log(`effects/${fileName(fx.name)}: ${file.length} bytes`);
}

// The demo: click anywhere to set off the picked effect: space for the next one, or the number keys 1 to 9.
const B = new Blocks(P), d = dsl(B);
const { v, set, whenFlag, whenKey, forever, waitUntil, mouseDown, not, mouseX, mouseY, cloneOfValue, hide } = d;
B.script(whenFlag(), [hide(), set("effect", "FX Explosion"), forever([
  waitUntil(mouseDown()),
  // The text sprites use fx text: a sample (the other effects don't mind).
  set(FX_TEXT, d.item("samples", d.random(1, SAMPLES.length))),
  set(FX_X, mouseX()), set(FX_Y, mouseY()), cloneOfValue(v("effect")),
  waitUntil(not(mouseDown())),
])], 20, 20);
list.slice(0, 9).forEach((fx, i) => B.script(whenKey(String(i + 1)), [set("effect", fx.name)], 400, 20 + i * 70));
// Space: the next effect (after the last one, the first again).
B.script(whenKey("space"), [d.cond(list.map((fx, i) => [d.eq(v("effect"), fx.name), [set("effect", list[(i + 1) % list.length].name)]] as [any, any[]]))], 800, 20);
const blank = P.costume("blank", `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>`, 1, 1);
const sb3 = P.build({
  backdrop: art(P).backdrop,
  sprites: [
    P.sprite("Demo", { blocks: B, costumes: [blank], layer: 1, visible: false }),
    ...list.map((fx, i) => ({ ...fx.sprite, layerOrder: i + 2 })),
  ],
  listValues: { samples: SAMPLES },
  shown: ["effect"],
});
writeFileSync(new URL("effects-demo.sb3", import.meta.url), sb3);
console.log(`effects-demo.sb3: ${sb3.length} bytes`);

// The sounds on their own, for the library page.
mkdirSync(new URL("effects/sounds/", import.meta.url), { recursive: true });
for (const fx of list) writeFileSync(new URL(`effects/sounds/${fx.sound}.wav`, import.meta.url), wav(SOUNDS[fx.sound]()));

// The library page (the pictures come from tests/fx-sprites.test.ts).
const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const base = (name: string) => fileName(name).replace(".sprite3", "");
const card = (fx: typeof list[number]) => `    <article class="card">
      <img src="effects/${base(fx.name)}.png" alt="${esc(fx.title)} effect" width="480" height="360" loading="lazy">
      <div class="card-body">
        <h3>${esc(fx.title)}</h3>
        <p class="sprite-name"><code>${esc(fx.name)}</code></p>
        <p>${esc(fx.about)}</p>
        <audio controls preload="none" src="effects/sounds/${fx.sound}.wav" aria-label="${esc(fx.title)} sound"></audio>
        <a class="btn" href="effects/${fileName(fx.name)}" download>Download ${fileName(fx.name)}</a>
      </div>
    </article>`;
const cards = list.filter(fx => fx.section === "boom").map(card).join("\n");
const textCards = list.filter(fx => fx.section === "text").map(card).join("\n");
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Effect Sprites</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400&display=swap">
<style>
:root {
  --bg: #f4f3fa; --surface: #ffffff; --fg: #1f1d33; --muted: #5c5a74; --line: #dddbea;
  --accent: #3b3f9e; --accent-soft: #e6e6fa; --warm: #d97706; --code-bg: #f8f7fd;
  --display: "Fredoka", "Trebuchet MS", system-ui, sans-serif;
  --body: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #13121f; --surface: #1c1a2c; --fg: #ebe9f7; --muted: #a6a3bf; --line: #312e47;
  --accent: #a5a8ff; --accent-soft: #23244a; --warm: #fbbf24; --code-bg: #232036; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #13121f; --surface: #1c1a2c; --fg: #ebe9f7; --muted: #a6a3bf; --line: #312e47;
  --accent: #a5a8ff; --accent-soft: #23244a; --warm: #fbbf24; --code-bg: #232036; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 18px/1.6 var(--body);
  padding: 40px max(16px, env(safe-area-inset-right, 0px)) 72px max(16px, env(safe-area-inset-left, 0px)); }
main { max-width: 980px; margin: 0 auto; display: grid; gap: 48px; }
main > *, .stack > * { min-width: 0; }
h1, h2, h3 { font-family: var(--display); font-weight: 600; margin: 0; line-height: 1.15; text-wrap: balance; }
h1 { font-size: clamp(2rem, 6vw, 2.9rem); }
h2 { font-size: 1.6rem; }
h3 { font-size: 1.25rem; }
p { margin: 0; max-width: 66ch; }
a { color: var(--accent); }
code { font: 0.88em var(--mono); background: var(--code-bg); padding: 1px 5px; border-radius: 4px; }
.eyebrow { font: 600 0.78rem var(--body); letter-spacing: 0.08em; text-transform: uppercase; color: var(--warm); }
.intro, .stack { display: grid; gap: 14px; }
.intro p { color: var(--muted); font-size: 1.08rem; }
ol.how { margin: 0; padding-left: 1.4em; display: grid; gap: 10px; max-width: 66ch; }
.blocks-panel { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px; overflow-x: auto; }
pre.blocks { margin: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 20px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; display: grid; grid-template-rows: auto 1fr; }
.card img { width: 100%; height: auto; display: block; aspect-ratio: 4 / 3; }
.card-body { padding: 14px 16px 16px; display: grid; gap: 8px; align-content: start; }
.card-body p { color: var(--muted); font-size: 0.98rem; }
.sprite-name { font-size: 0.9rem; }
audio { width: 100%; height: 36px; }
.btn { display: inline-block; justify-self: start; background: var(--accent); color: var(--surface); text-decoration: none; font-weight: 700;
  padding: 8px 14px; border-radius: 8px; font-size: 0.95rem; }
.note { background: var(--accent-soft); border-radius: 8px; padding: 12px 16px; max-width: 66ch; }
footer { color: var(--muted); font-size: 0.92rem; border-top: 2px solid var(--line); padding-top: 24px; }
</style>
</head>
<body>
<main>
  <header class="intro">
    <span class="eyebrow">Scratch sprite library</span>
    <h1>Effect Sprites</h1>
    <p>Ready-made explosion effects for your own Scratch games, each with its own sound. Every sprite hides when the green flag is clicked and plays its effect in a clone, wherever you ask, then cleans up after itself.</p>
  </header>

  <section class="stack">
    <h2>How to use them</h2>
    <ol class="how">
      <li>Download a sprite below (a <code>.sprite3</code> file).</li>
      <li>In the Scratch editor, point at the cat button at the bottom right of the sprite list and choose <b>Upload Sprite</b>. Pick the file.</li>
      <li>Scratch makes two variables for all sprites, <code>${FX_X}</code> and <code>${FX_Y}</code>: that is where the effect plays.</li>
      <li>In any sprite (a ship that is hit, a balloon that pops), set them and make a clone of the effect:</li>
    </ol>
    <div class="blocks-panel"><pre class="blocks">set [${FX_X} v] to (x position)
set [${FX_Y} v] to (y position)
create clone of [FX Explosion v]</pre></div>
    <p class="note">That's all: you don't need to change anything inside the effect sprite. Use as many as you like, and as often as you like: every clone plays on its own and deletes itself.</p>
    <p>Try them all first: <a href="effects-demo.sb3" download>effects-demo.sb3</a> has every effect. Press space for the next effect (or 1 to 9), and click anywhere on the stage.</p>
  </section>

  <section class="stack">
    <h2>The sprites</h2>
    <div class="grid">
${cards}
    </div>
  </section>

  <section class="stack">
    <h2>Floating text</h2>
    <p>Score pop-ups and messages. These use a third variable for all sprites, <code>${FX_TEXT}</code>: set it to the words, then make the clone.</p>
    <div class="blocks-panel"><pre class="blocks">set [${FX_TEXT} v] to (join [+] (points))
set [${FX_X} v] to (x position)
set [${FX_Y} v] to ((y position) + (30))
create clone of [FX Float Text v]</pre></div>
    <p class="note">Each letter is a clone with its own costume, so the letters can move one by one. Letters, digits and <code>+ - ! ? . , : ' % $ # * / = ( ) &amp; @</code> are in the font; anything else (a space, too) just leaves a gap. Keep it short: about 12 characters fit across the stage.</p>
    <div class="grid">
${textCards}
    </div>
  </section>

  <section class="stack">
    <h2>How they work</h2>
    <p>Open a sprite's code to see. The clone you make goes to <code>${FX_X}</code>, <code>${FX_Y}</code> and starts its sound. A simple effect (Pop, Fireball, Shockwave) then just changes its costume, size or ghost effect. A bigger one makes pieces: more clones of itself, each with a <b>role</b> (spark, ember, smoke, ...), and the first clone waits until its sound is over before it deletes itself, because a deleted clone's sound stops too. Debris bounces on the bottom of the stage.</p>
  </section>

  <footer>Made with the Scratch workbench in this repository. The artwork and the sounds are original; the sounds are made by a small synthesiser in code.</footer>
</main>
<script src="https://cdn.jsdelivr.net/npm/scratchblocks@3.6.4/build/scratchblocks.min.js"></script>
<script>
  scratchblocks.renderMatching("pre.blocks", { style: "scratch3", languages: ["en"], scale: 0.8 });
</script>
</body>
</html>
`;
writeFileSync(new URL("index.html", import.meta.url), page);
console.log("index.html written");
