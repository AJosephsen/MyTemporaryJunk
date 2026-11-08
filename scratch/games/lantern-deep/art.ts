// Artwork for Lantern Deep: 32-pixel squares, the miner, the lantern and the backdrop. All original SVG.
import type { Project } from "../../lib/sb3.ts";

export const CELL = 32, COLS = 15;
export const LEFT = -224;            // centre x of column 0
// Kinds of square, in costume order after "dark" (costume 1). Costume number = kind + 1.
export const KINDS = [
  { name: "dirt", hp: 1, value: 0 }, { name: "stone", hp: 3, value: 0 }, { name: "bedrock", hp: 9999, value: 0 },
  { name: "coal", hp: 2, value: 2 }, { name: "copper", hp: 2, value: 5 }, { name: "silver", hp: 3, value: 12 },
  { name: "gold", hp: 3, value: 25 }, { name: "ruby", hp: 4, value: 60 }, { name: "emerald", hp: 4, value: 90 },
  { name: "diamond", hp: 6, value: 200 }, { name: "lava", hp: 9999, value: 0 }, { name: "hardrock", hp: 8, value: 0 },
] as const;
export const KIND = Object.fromEntries(KINDS.map((k, i) => [k.name, i + 1])) as Record<(typeof KINDS)[number]["name"], number>;

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const specks = (fill: string, seed: number) => Array.from({ length: 7 }, (_, i) => {
  const x = 3 + ((i * 11 + seed * 7) % 26), y = 3 + ((i * 17 + seed * 5) % 26), r = 1 + ((i + seed) % 3) * 0.6;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
}).join("");
const square = (fill: string, speck: string, seed = 1) => `<rect width="32" height="32" fill="${fill}"/>${specks(speck, seed)}`;
const dirt = square("#7a4b2b", "#653c21");
const stone = square("#6e6a68", "#5a5654", 2) + `<path d="M4 20 l8 -3 l6 4 M18 8 l6 3" stroke="#585452" stroke-width="1.4" fill="none"/>`;
const ore = (base: string, colors: string[]) => base + colors.map((c, i) => {
  const [x, y] = [[9, 10], [21, 13], [13, 22], [24, 24]][i];
  return `<path d="M${x - 4} ${y} l4 -4 l4 4 l-4 4 z" fill="${c}" stroke="#00000055" stroke-width="0.8"/>`;
}).join("");
const gem = (base: string, fill: string, light: string) => base +
  `<path d="M16 6 l8 6 l-8 14 l-8 -14 z" fill="${fill}" stroke="#00000066" stroke-width="1"/><path d="M12 11 l4 -3 l1 6 z" fill="${light}"/>`;
const costumes: Record<string, string> = {
  dark: square("#1f1712", "#2a1f18", 3),
  dirt, stone,
  bedrock: `<rect width="32" height="32" fill="#2b2338"/><path d="M0 11 H32 M0 22 H32 M11 0 V11 M23 11 V22 M8 22 V32 M27 22 V32" stroke="#1b1524" stroke-width="2"/>`,
  coal: ore(dirt, ["#1b1b1b", "#2b2b2b", "#151515"]),
  copper: ore(dirt, ["#d9773a", "#b85d25", "#e8925a"]),
  silver: ore(stone, ["#e6e9ee", "#b9c0ca", "#ffffff"]),
  gold: ore(stone, ["#f5c518", "#e0a800", "#ffe066", "#f5c518"]),
  ruby: gem(stone, "#e0304e", "#ffc2cc"),
  emerald: gem(stone, "#21b35c", "#b8f5cf"),
  diamond: gem(stone, "#d8f6ff", "#ffffff") + `<path d="M26 4 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 l3 -1 z" fill="#fff36b"/>`,
  lava: `<rect width="32" height="32" fill="#c2410c"/><path d="M0 12 q8 -6 16 0 t16 0 V32 H0 z" fill="#f97316"/>` +
    `<path d="M0 22 q8 -5 16 0 t16 0 V32 H0 z" fill="#fbbf24"/><circle cx="9" cy="8" r="2" fill="#fde68a"/>`,
  hardrock: square("#3f3a4a", "#332f3d", 4) + `<path d="M3 8 l9 4 l7 -3 l10 5 M5 25 l8 -4 l9 5" stroke="#5a5468" stroke-width="1.6" fill="none"/>`,
};

const miner = (flip: boolean) => svg(32, 32, `<g transform="${flip ? "translate(32 0) scale(-1 1)" : ""}">` +
  `<rect x="10" y="17" width="12" height="10" rx="3" fill="#2f6fd6"/>` +
  `<rect x="11" y="26" width="4" height="5" rx="1.5" fill="#3b2a20"/><rect x="18" y="26" width="4" height="5" rx="1.5" fill="#3b2a20"/>` +
  `<circle cx="16" cy="12" r="6.5" fill="#f2c9a0"/><circle cx="18.5" cy="12" r="1.2" fill="#2a1d14"/>` +
  `<path d="M8.5 10 a7.5 7 0 0 1 15 0 z" fill="#f5c518"/><rect x="7.5" y="9" width="17" height="2.5" rx="1" fill="#d9a800"/>` +
  `<circle cx="23" cy="8.5" r="2.2" fill="#fffbe0" stroke="#d9a800"/>` +
  `<path d="M22 19 l6 -6" stroke="#8a5a2b" stroke-width="2"/><path d="M26 11 l4 4" stroke="#d9dde4" stroke-width="2.5" stroke-linecap="round"/>` +
  `</g>`);
// The lantern's light: a soft glow drawn over everything; its round shape is what squares touch to be seen.
const glow = svg(160, 160, `<defs><radialGradient id="g"><stop offset="0" stop-color="#ffe9a8" stop-opacity="0.22"/>` +
  `<stop offset="0.7" stop-color="#ffe9a8" stop-opacity="0.08"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient></defs>` +
  `<circle cx="80" cy="80" r="78" fill="url(#g)"/>`);
// A cave crawler: a dark beetle with glowing eyes, seen even in the dark. Facing right; flipped for left.
const crawler = (flip: boolean) => svg(32, 24, `<g transform="${flip ? "translate(32 0) scale(-1 1)" : ""}">` +
  `<ellipse cx="15" cy="15" rx="12" ry="8" fill="#3b2f4a" stroke="#1e1726" stroke-width="1.5"/>` +
  `<path d="M6 20 l-3 3 M11 22 l-1 2 M19 22 l1 2 M24 20 l3 3" stroke="#1e1726" stroke-width="1.6"/>` +
  `<circle cx="22" cy="12" r="2.4" fill="#b6ff5c"/><circle cx="26" cy="13" r="2" fill="#b6ff5c"/>` +
  `<path d="M24 7 q4 -5 7 -4 M21 7 q2 -5 5 -6" stroke="#5c4a70" stroke-width="1.3" fill="none"/></g>`);
// Pickaxe icons for the score bar: wood, stone, iron, diamond.
const pickIcon = (head: string) => svg(32, 32,
  `<path d="M9 27 l14 -14" stroke="#8a5a2b" stroke-width="3.5" stroke-linecap="round"/>` +
  `<path d="M5 12 q12 -12 24 2 q-10 -6 -21 3 z" fill="${head}" stroke="#00000066" stroke-width="1"/>`);
const dot = svg(6, 6, `<rect width="6" height="6" fill="#ffffff"/>`);
const backdrop = svg(480, 360, `<rect width="480" height="360" fill="#0f0b09"/>`);

export function art(P: Project) {
  return {
    squares: ["dark", ...KINDS.map(k => k.name)].map(n => P.costume(n, svg(32, 32, costumes[n]), 16, 16)),
    miner: [P.costume("right", miner(false), 16, 16), P.costume("left", miner(true), 16, 16)],
    lantern: [P.costume("light", glow, 80, 80)],
    pick: [P.costume("dot", dot, 3, 3)],
    crawler: [P.costume("right", crawler(false), 16, 12), P.costume("left", crawler(true), 16, 12)],
    pickaxes: [["wood", "#a8743f"], ["stone", "#8d8a88"], ["iron", "#c9d1db"], ["diamond", "#9fe8ff"]]
      .map(([n, c]) => P.costume(n, pickIcon(c), 16, 16)),
    backdrop: P.costume("cave", backdrop, 240, 180),
  };
}
