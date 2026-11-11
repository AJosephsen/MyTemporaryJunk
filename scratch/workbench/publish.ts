// npm run publish -- <out folder>
// Builds the public site (the scratch-fun repository): only Scratch files and tutorial pages, nothing that runs.
//   tutorials/<name>/  the tutorial page with its block pictures drawn in (no scripts), its pictures, starter.sb3, stepN.sb3
//   games/             every finished game as .sb3, with a still picture of each
//   index.html, README.md  lists of the tutorials and games
// The tooling (generators, workbench, tests) stays in this repository. Everything in <out folder> except .git is
// replaced.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { createRequire } from "node:module";
import { ROOT, startServer } from "./server.ts";

const OUT = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(OUT)) throw new Error("usage: npm run publish -- <existing out folder>");
const SOURCE = "https://github.com/AJosephsen/MyTemporaryJunk/raw/main/scratch/";
const SITE = "https://ajosephsen.github.io/scratch-fun/";   // where the site lives (GitHub Pages); the QR code points here

// The finished games: [file name in games/, source .sb3, title, one line].
const GAMES: [string, string, string, string][] = [
  ["dust-hopper", "games/dust-hopper/dust-hopper.sb3", "Dust Hopper", "Land the survey drone gently on a yellow pad."],
  ["comet-rally", "tutorials/comet-rally/step6.sb3", "Comet Rally", "A two-paddle rally against a robot."],
  ["glimmer-pop", "games/glimmer-pop/glimmer-pop.sb3", "Glimmer Pop", "Aim and pop bubbles: three of a colour burst."],
  ["deep-dig", "games/deep-dig/deep-dig.sb3", "Deep Dig", "Dig for gold and gems; watch out for falling rocks."],
  ["lantern-deep", "games/lantern-deep/lantern-deep.sb3", "Lantern Deep", "Dig down forever; your lantern shows treasure, lava and crawlers."],
  ["beanstalk-bounce", "games/beanstalk-bounce/beanstalk-bounce.sb3", "Beanstalk Bounce", "Bounce up the beanstalk, leaf by leaf."],
  ["sky-guard", "games/sky-guard/sky-guard.sb3", "Sky Guard", "Turn the cannon and shoot the falling meteors."],
  ["sheepdog", "games/sheepdog/sheepdog.sb3", "Sheepdog", "Herd all eight sheep into the pen."],
  ["splat-patrol", "games/splat-patrol/splat-patrol.sb3", "Splat Patrol", "Splat the raccoon bandits, not the villagers."],
  ["splat-patrol-deluxe", "games/splat-patrol/splat-patrol-deluxe.sb3", "Splat Patrol Deluxe", "Raccoons in disguise, combos, splashes and more."],
];
// The tutorials, in the order of the list (easiest first).
const TUTORIALS = ["sky-guard", "sheepdog", "maze-maker", "splat-patrol", "beanstalk-bounce", "comet-rally", "dust-hopper", "lantern-deep"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();

// ---------------------------------------------------------------- clean the out folder (keep .git)
for (const f of readdirSync(OUT)) if (f !== ".git") rmSync(join(OUT, f), { recursive: true, force: true });
mkdirSync(join(OUT, "tutorials"), { recursive: true });
mkdirSync(join(OUT, "games"), { recursive: true });

// ---------------------------------------------------------------- tutorials
type Meta = { name: string; title: string; eyebrow: string; lead: string; picture: string };
const tutorials: Meta[] = [];
for (const name of TUTORIALS) {
  const src = join(ROOT, "tutorials", name), dst = join(OUT, "tutorials", name);
  mkdirSync(dst, { recursive: true });
  const files = readdirSync(src).filter(f => /\.(sb3|png)$/.test(f));
  for (const f of files) copyFileSync(join(src, f), join(dst, f));

  // Draw the block pictures once, then save the page without any scripts.
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto("file://" + join(src, "index.html"));
  // scratchblocks draws each picture inside its <pre class="blocks">.
  await page.waitForFunction(() => Array.from(document.querySelectorAll("pre.blocks")).every(p => p.querySelector("svg")),
    null, { timeout: 30000 });
  const meta = await page.evaluate(() => {
    for (const s of Array.from(document.querySelectorAll("script"))) s.remove();
    document.querySelector('meta[name="claude:viewport-fit-sides"]')?.remove();
    const head = document.head;
    head.insertAdjacentHTML("afterbegin", '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">');
    const text = (sel: string) => (document.querySelector(sel)?.textContent ?? "").trim();
    return { title: text("h1"), eyebrow: text(".eyebrow"), lead: text("header.intro p") };
  });
  let html = "<!doctype html>\n" + (await page.content());
  await page.close();
  // Download links point to the files next to the page (and to the games folder).
  html = html.split(`${SOURCE}tutorials/${name}/`).join("");
  html = html.replace(new RegExp(`${SOURCE}games/[^/"]+/([^/"]+\\.sb3)`, "g"), "../../games/$1");
  if (html.includes("MyTemporaryJunk")) throw new Error(`${name}: a link to MyTemporaryJunk is left`);
  if (/<script/i.test(html)) throw new Error(`${name}: a script is left`);
  writeFileSync(join(dst, "index.html"), html);
  const steps = files.filter(f => /^step\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4)));
  tutorials.push({ name, ...meta, picture: `tutorials/${name}/${steps[steps.length - 1]}` });
  console.log(`tutorials/${name}: ${files.length + 1} files`);
}

// ---------------------------------------------------------------- games, with a still picture of each
const server = await startServer();
for (const [name, from] of GAMES) {
  copyFileSync(join(ROOT, from), join(OUT, "games", `${name}.sb3`));
  const page = await browser.newPage({ viewport: { width: 760, height: 600 } });
  await page.goto(server.url + "?test=1");
  await page.waitForFunction(() => document.body.dataset.ready === "1");
  await page.evaluate(async (p: string) => {
    const w = (window as any).workbench;
    await w.load(p); w.mouse(0, 0); await w.greenFlag(); await w.step(150);
  }, from);
  await page.locator("#stage").screenshot({ path: join(OUT, "games", `${name}.png`) });
  await page.close();
  console.log(`games/${name}.sb3`);
}
await server.close();
await browser.close();

// ---------------------------------------------------------------- index.html and README.md
// A QR code for the site, drawn as a plain SVG picture (black on white, so phones can read it in dark mode too).
const qr = (await createRequire(import.meta.url)("qrcode").toString(SITE, { type: "svg", margin: 2, errorCorrectionLevel: "M" }) as string)
  .replace("<svg ", `<svg role="img" aria-label="QR code for ${SITE}" `);
const card = (href: string, img: string, title: string, sub: string, text: string) =>
  `<a class="card" href="${href}"><img src="${img}" alt="" loading="lazy" width="480" height="360"><span class="t">${esc(title)}</span>` +
  `<span class="s">${esc(sub)}</span><span class="d">${esc(text)}</span></a>`;
const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scratch Fun</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
:root { --bg: #fff8ec; --surface: #ffffff; --fg: #2a1f14; --muted: #6b5b4a; --line: #ecdcc4; --accent: #c2410c;
  --display: "Fredoka", "Trebuchet MS", sans-serif; --body: "Atkinson Hyperlegible", "Segoe UI", sans-serif; }
@media (prefers-color-scheme: dark) { :root { --bg: #18130e; --surface: #221b14; --fg: #f3e9dc; --muted: #bba994; --line: #3a2f24; --accent: #fb923c; color-scheme: dark; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 17px/1.55 var(--body); padding: 40px max(16px, env(safe-area-inset-left)) 72px; }
main { max-width: 1040px; margin: 0 auto; display: grid; gap: 40px; }
h1, h2 { font-family: var(--display); font-weight: 600; margin: 0; }
h1 { font-size: clamp(2.2rem, 6vw, 3.2rem); }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
header p { margin: 8px 0 0; color: var(--muted); max-width: 62ch; }
.qr { flex: none; display: grid; gap: 4px; justify-items: center; color: var(--muted); font-size: 0.8rem; text-decoration: none; }
.qr svg { width: 116px; height: 116px; border-radius: 8px; background: #fff; }
@media (max-width: 520px) { .qr svg { width: 84px; height: 84px; } }
.qr-big { display: none; position: fixed; inset: 0; z-index: 10; background: #fff; color: #1f2937; text-decoration: none;
  place-items: center; align-content: center; gap: 2vh; padding: 3vh; }
.qr-big:target { display: grid; }
.qr-big svg { width: min(92vw, 78vh); height: auto; }
.qr-big .url { font: 600 clamp(1.4rem, 4vh, 3rem) var(--display); }
.qr-big .hint { font-size: clamp(0.9rem, 2vh, 1.2rem); color: #6b7280; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; margin-top: 16px; }
.card { display: grid; gap: 4px; align-content: start; background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
  padding: 10px 10px 14px; color: inherit; text-decoration: none; }
.card:hover, .card:focus-visible { border-color: var(--accent); outline: none; }
.card img { width: 100%; height: auto; border-radius: 8px; display: block; margin-bottom: 6px; }
.t { font: 600 1.15rem var(--display); }
.s { font-size: 0.8rem; color: var(--accent); font-weight: 700; }
.d { font-size: 0.92rem; color: var(--muted); }
footer { color: var(--muted); font-size: 0.9rem; border-top: 1px solid var(--line); padding-top: 20px; }
a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <h1>Scratch Fun</h1>
      <p>Step-by-step Scratch tutorials for kids, and finished games to download, open in the Scratch editor and remix. Every tutorial step has its own project file, so you can always catch up.</p>
    </div>
    <a class="qr" href="#qr" title="Show the QR code big">${qr}<span>Open on a phone</span></a>
  </header>
  <!-- The big QR code for a classroom screen: shown while the address ends in #qr (CSS :target, no script);
       a click anywhere goes back. -->
  <a id="qr" class="qr-big" href="#" title="Close">${qr}<span class="url">${SITE.replace("https://", "")}</span><span class="hint">Click anywhere to close</span></a>
  <section>
    <h2>Tutorials</h2>
    <div class="grid">
${tutorials.map(t => "      " + card(`tutorials/${t.name}/`, t.picture, t.title, t.eyebrow, t.lead)).join("\n")}
    </div>
  </section>
  <section>
    <h2>Games</h2>
    <p>Download a game (<b>.sb3</b>), then open it at <a href="https://scratch.mit.edu/projects/editor/">scratch.mit.edu/projects/editor</a> with <b>File › Load from your computer</b>.</p>
    <div class="grid">
${GAMES.map(([n, , title, line]) => "      " + card(`games/${n}.sb3`, `games/${n}.png`, title, "Scratch project (.sb3)", line)).join("\n")}
    </div>
  </section>
  <footer>All games, characters and artwork are original. Made with a small Scratch workbench that writes the projects from code and tests them.</footer>
</main>
</body>
</html>
`;
writeFileSync(join(OUT, "index.html"), index);
const readme = `# Scratch Fun

Step-by-step Scratch tutorials for kids, and finished games to download and remix in the Scratch editor
([scratch.mit.edu/projects/editor](https://scratch.mit.edu/projects/editor/), **File › Load from your computer**).
Open \`index.html\` for the overview.

## Tutorials

| Tutorial | Level | About |
|---|---|---|
${tutorials.map(t => `| [${t.title}](tutorials/${t.name}/index.html) | ${t.eyebrow} | ${t.lead.replace(/\|/g, "/")} |`).join("\n")}

Every tutorial folder has \`starter.sb3\` (artwork, no code) and a \`stepN.sb3\` for the end of each step.

## Games

| Game | About |
|---|---|
${GAMES.map(([n, , title, line]) => `| [${title}](games/${n}.sb3) | ${line} |`).join("\n")}

All games, characters and artwork are original.
`;
writeFileSync(join(OUT, "README.md"), readme);
console.log(`index.html, README.md: ${tutorials.length} tutorials, ${GAMES.length} games`);
