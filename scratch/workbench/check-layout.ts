// npm run check:layout [-- <picture.png> <project.sb3> <sprite>]
// Checks that no two scripts of a sprite overlap in the Scratch editor, in every .sb3 in this folder. Each script is
// drawn with scratchblocks in the Scratch 3 style (the editor's block sizes) at the x, y that lib/layout.ts gave it.
// With arguments, it also saves a picture of one sprite's scripts as the editor would place them.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import { ROOT } from "./server.ts";
import { projectJson } from "../lib/tutorial.ts";
import { scriptsWithIds } from "../tools/scratchblocks/to-scratchblocks.ts";

const SKIP = new Set(["node_modules", "export", ".git"]);
const walk = (d: string): string[] => readdirSync(d).flatMap(n => SKIP.has(n) ? [] : statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]);
type Item = { sprite: string; x: number; y: number; t: string; w?: number; h?: number };
const items: Item[] = [];
for (const f of walk(ROOT).filter(f => f.endsWith(".sb3"))) {
  for (const t of projectJson(readFileSync(f)).targets)
    for (const [id, text] of scriptsWithIds(t.blocks)) items.push({ sprite: `${relative(ROOT, f)} / ${t.name}`, x: t.blocks[id].x, y: t.blocks[id].y, t: text });
}

const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<body></body>");
await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/scratchblocks@3.6.4/build/scratchblocks.min.js" });
const sizes: [number, number][] = await page.evaluate((texts: string[]) => texts.map(t => {
  const svg = (window as any).scratchblocks.render((window as any).scratchblocks.parse(t, { languages: ["en"] }), { style: "scratch3", scale: 1 });
  return [+svg.getAttribute("width"), +svg.getAttribute("height")];
}), items.map(i => i.t));
items.forEach((it, i) => { it.w = sizes[i][0]; it.h = sizes[i][1]; });

const bySprite = new Map<string, Item[]>();
for (const it of items) bySprite.set(it.sprite, [...(bySprite.get(it.sprite) ?? []), it]);
const overlaps: string[] = [];
let smallest = Infinity;
for (const [sprite, list] of bySprite) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
  const a = list[i], b = list[j];
  const gap = Math.max(b.x - (a.x + a.w!), a.x - (b.x + b.w!), b.y - (a.y + a.h!), a.y - (b.y + b.h!));
  smallest = Math.min(smallest, gap);
  if (gap < 0) overlaps.push(`${sprite}: "${a.t.split("\n")[0]}" and "${b.t.split("\n")[0]}"`);
}
console.log(`${items.length} scripts in ${bySprite.size} sprites; smallest gap ${smallest}; ${overlaps.length} overlapping pairs`);
for (const o of overlaps.slice(0, 20)) console.log("  " + o);

const [out, project, sprite] = process.argv.slice(2);
if (out) {
  const list = bySprite.get(`${project} / ${sprite}`) ?? [];
  if (!list.length) throw new Error(`no scripts for ${project} / ${sprite}`);
  const W = Math.max(...list.map(i => i.x + i.w!)) + 40, H = Math.max(...list.map(i => i.y + i.h!)) + 40;
  await page.setViewportSize({ width: Math.min(W, 4000), height: Math.min(H, 4000) });
  await page.evaluate(([list, W, H]: [Item[], number, number]) => {
    document.body.style.cssText = `margin:0;background:#f9f9f9 radial-gradient(#ddd 1px, transparent 1px) 0 0/24px 24px;width:${W}px;height:${H}px;position:relative`;
    for (const it of list) {
      const svg = (window as any).scratchblocks.render((window as any).scratchblocks.parse(it.t, { languages: ["en"] }), { style: "scratch3", scale: 1 });
      svg.style.cssText = `position:absolute;left:${it.x}px;top:${it.y}px`; document.body.appendChild(svg);
    }
  }, [list, W, H]);
  await page.screenshot({ path: out });
  console.log(`picture: ${out}`);
}
await browser.close();
process.exit(overlaps.length ? 1 : 0);
