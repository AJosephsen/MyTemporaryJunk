// Artwork for Number Bonds Pop: three ocean depths, glassy bubbles (normal, selected, gold, rainbow), fish, hearts.
// Original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// Light rays from the surface, seaweed and rocks on the floor.
const rays = (op: number) => [40, 150, 260, 380].map((x, i) =>
  `<path d="M${x} 0 L${x + 50} 0 L${x + 120 - i * 10} 360 L${x + 40 - i * 10} 360z" fill="#fff" opacity="${op}"/>`).join("");
const weed = (x: number, h: number, c: string) =>
  `<path d="M${x} 360 C${x - 14} ${360 - h * 0.3} ${x + 14} ${360 - h * 0.6} ${x} ${360 - h} C${x + 10} ${360 - h * 0.6} ${x - 6} ${360 - h * 0.3} ${x + 8} 360z" fill="${c}"/>`;
const floor = (rock: string, w: string) =>
  `<path d="M0 340 Q60 320 120 338 T240 332 T360 340 T480 330 V360 H0z" fill="${rock}"/>` +
  [[30, 90], [52, 60], [140, 70], [330, 100], [352, 70], [440, 80]].map(([x, h]) => weed(x, h, w)).join("");
const glow = (n: number) => Array.from({ length: n }, (_, i) =>
  `<circle cx="${(i * 89 + 31) % 480}" cy="${(i * 53 + 40) % 300}" r="${1 + (i % 3)}" fill="#a5f3fc" opacity="${0.3 + (i % 4) * 0.12}"/>`).join("");
const sea = (top: string, bottom: string, extra: string) => svg(480, 360,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#g)"/>${extra}`);
const seas: [string, string][] = [
  ["shallow", sea("#22d3ee", "#0369a1", rays(0.08) + floor("#d6b98c", "#16a34a"))],
  ["deep", sea("#0e7490", "#1e3a8a", rays(0.04) + floor("#57534e", "#0f766e"))],
  ["abyss", sea("#0c1e3e", "#020617", glow(40) + floor("#1c1917", "#134e4a"))],
];

// A glassy bubble, 70 px across: rim, tint, highlight.
const R = 35;
const bubble = (fill: string, rim: string, extra = "") => svg(2 * R + 8, 2 * R + 8,
  `<defs><radialGradient id="b" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/>` +
  `<stop offset="0.6" stop-color="${fill}" stop-opacity="0.35"/><stop offset="1" stop-color="${fill}" stop-opacity="0.75"/></radialGradient></defs>` +
  extra + `<circle cx="${R + 4}" cy="${R + 4}" r="${R}" fill="url(#b)" stroke="${rim}" stroke-width="3"/>` +
  `<ellipse cx="${R - 8}" cy="${R - 12}" rx="10" ry="6" fill="#fff" opacity="0.8" transform="rotate(-30 ${R - 8} ${R - 12})"/>`);
const rainbowRim = `<defs><linearGradient id="r" x1="0" y1="0" x2="1" y2="1">${["#ef4444", "#f59e0b", "#facc15", "#22c55e", "#3b82f6", "#a855f7"]
  .map((c, i) => `<stop offset="${i / 5}" stop-color="${c}"/>`).join("")}</linearGradient></defs>`;

const fish = (body: string, fin: string) => svg(60, 34,
  `<path d="M8 17 L0 5 L0 29z" fill="${fin}"/><ellipse cx="32" cy="17" rx="24" ry="13" fill="${body}"/>` +
  `<path d="M28 5 Q36 0 42 6" fill="${fin}"/><circle cx="46" cy="14" r="3" fill="#fff"/><circle cx="47" cy="14" r="1.5" fill="#0f172a"/>`);

const heart = (on: boolean) => svg(36, 32,
  `<path d="M18 30 C4 20 0 13 3 7 C6 1 14 1 18 8 C22 1 30 1 33 7 C36 13 32 20 18 30z" fill="${on ? "#ef4444" : "#475569"}" stroke="#1e293b" stroke-width="2.5"/>` +
  (on ? `<ellipse cx="11" cy="10" rx="4" ry="2.5" fill="#fff" opacity="0.6"/>` : ""));
const hud = svg(480, 46, `<rect width="480" height="46" fill="#082f49" opacity="0.6"/><rect y="44" width="480" height="2" fill="#67e8f9" opacity="0.8"/>`);
const flash = (c: string) => svg(480, 360, `<rect width="480" height="360" fill="${c}"/>`);

export function art(P: Project) {
  const c = R + 4;
  return {
    backdrop: seas.map(([n, s]) => P.costume(n, s, 240, 180)),
    bubble: [
      P.costume("plain", bubble("#38bdf8", "#e0f2fe"), c, c),
      P.costume("sel", bubble("#fde047", "#fef08a", `<circle cx="${c}" cy="${c}" r="${R + 3}" fill="#fde047" opacity="0.45"/>`), c, c),
      P.costume("gold", bubble("#f59e0b", "#fde68a"), c, c),
      P.costume("rainbow", bubble("#c084fc", "url(#r)", rainbowRim), c, c),
    ],
    fish: [P.costume("orange", fish("#fb923c", "#ea580c"), 30, 17), P.costume("teal", fish("#2dd4bf", "#0d9488"), 30, 17),
      P.costume("pink", fish("#f472b6", "#db2777"), 30, 17)],
    heart: [P.costume("on", heart(true), 18, 16), P.costume("off", heart(false), 18, 16)],
    hud: [P.costume("hud", hud, 240, 23)],
    flash: [P.costume("white", flash("#fff"), 240, 180), P.costume("red", flash("#ef4444"), 240, 180)],
  };
}
