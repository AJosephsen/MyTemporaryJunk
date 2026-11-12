// Draws the math games' sprite font: one PNG per character (digits and maths symbols) and per banner word, in a chunky
// rounded font with a thick outline and a golden gradient. Run once after a change; the PNGs and font.json are kept in
// git and used as costumes (double resolution: 120 pixels high = 60 on the Stage).
// Run: node --experimental-strip-types --no-warnings make-font.ts
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

export const GLYPHS: [string, string][] = [
  ..."0123456789".split("").map(c => [c, c] as [string, string]),
  ["+", "plus"], ["−", "minus"], ["×", "times"], ["÷", "divide"], ["=", "equals"], ["?", "query"], ["x", "x"],
  ["!", "bang"], [",", "comma"], ["★", "star"], ["°", "deg"], ["<", "lt"], [">", "gt"], [".", "dot"], ["/", "slash"],
];
// Words with a game name only go into that game's costumes (see textCostumes).
export const WORDS: [string, string, string?][] = [
  ["NUMBER", "title1", "number-blaster"], ["BLASTER", "title2", "number-blaster"],
  ["TIMES TABLE", "tower1", "times-table-tower"], ["TOWER", "tower2", "times-table-tower"], ["QUICK!", "quick"],
  ["WOBBLY!", "wobbly"], ["FLOOR", "floor"], ["NUMBER BONDS", "bonds1", "number-bonds-pop"], ["POP!", "bonds2", "number-bonds-pop"],
  ["MAKE", "make", "number-bonds-pop"], ["GOLD!", "gold", "number-bonds-pop"], ["RAINBOW!", "rainbow", "number-bonds-pop"],
  ["SHAPE", "shape1", "shape-builder"], ["BUILDER", "shape2", "shape-builder"], ["DROP", "drop", "shape-builder"],
  ["TURNED", "turned", "shape-builder"], ["EXACT!", "exact", "shape-builder"], ["IT FITS!", "fits", "shape-builder"],
  ["GREATER", "gator1", "greater-gator"], ["GATOR", "gator2", "greater-gator"], ["SAME!", "same", "greater-gator"],
  ["TOO SLOW!", "slow", "greater-gator"], ["YUM!", "yum", "greater-gator"], ["COMBO", "combo"], ["PERFECT!", "perfect"], ["GREAT!", "great"],
  ["LEVEL", "level"], ["LEVEL UP!", "levelup"], ["BONUS", "bonus"], ["GAME OVER", "gameover"], ["CLICK TO PLAY", "clickplay"],
  ["SPEED BONUS", "speed"], ["SCORE", "score"], ["BEST", "best"], ["OOPS!", "oops"], ["SHIELD LOST", "shield"],
];

const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@700&display=block"><p style="font-family:Fredoka;font-weight:700">0</p>`);
await page.evaluate(() => (document as any).fonts.load("700 96px Fredoka"));
await page.waitForTimeout(500);

const draw = (text: string, height: number) => page.evaluate(([text, H]: [string, number]) => {
  const c = document.createElement("canvas"), g = c.getContext("2d")!;
  const size = H * 0.78, pad = H * 0.12;
  g.font = `700 ${size}px Fredoka`;
  const w = Math.ceil(g.measureText(text).width + pad * 2);
  c.width = w; c.height = H;
  g.font = `700 ${size}px Fredoka`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  const x = w / 2, y = H * 0.54;
  // shadow, outline, gradient fill, shine
  g.lineWidth = H * 0.16; g.strokeStyle = "rgba(0,0,0,0.35)"; g.strokeText(text, x + H * 0.03, y + H * 0.05);
  g.strokeStyle = "#3b1d0a"; g.strokeText(text, x, y);
  const grad = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  grad.addColorStop(0, "#fff7b0"); grad.addColorStop(0.45, "#ffd23f"); grad.addColorStop(1, "#f08a0c");
  g.fillStyle = grad; g.fillText(text, x, y);
  g.save(); g.beginPath(); g.rect(0, 0, w, y - size * 0.12); g.clip();
  g.fillStyle = "rgba(255,255,255,0.35)"; g.fillText(text, x, y); g.restore();
  return { url: c.toDataURL("image/png"), w };
}, [text, height] as [string, number]);

const out: { glyphs: { char: string; name: string; width: number }[]; words: { text: string; name: string; width: number; game?: string }[] } = { glyphs: [], words: [] };
for (const [char, name] of GLYPHS) {
  const r = await draw(char, 120);
  writeFileSync(new URL(`font/${name}.png`, import.meta.url), Buffer.from(r.url.split(",")[1], "base64"));
  out.glyphs.push({ char, name, width: r.w / 2 });
}
for (const [text, name, game] of WORDS) {
  const r = await draw(text, 120);
  writeFileSync(new URL(`font/word-${name}.png`, import.meta.url), Buffer.from(r.url.split(",")[1], "base64"));
  out.words.push({ text, name, width: r.w / 2, ...(game ? { game } : {}) });
}
writeFileSync(new URL("font/font.json", import.meta.url), JSON.stringify(out, null, 1));
await browser.close();
console.log(`${out.glyphs.length} glyphs, ${out.words.length} words`);
