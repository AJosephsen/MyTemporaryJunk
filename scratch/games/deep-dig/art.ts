// Artwork for Deep Dig: 32-pixel tiles, the miner and the backdrop. All original, drawn as SVG.
import type { Project } from "../../lib/sb3.ts";

export const CELL = 32, COLS = 15, ROWS = 10;
export const LEFT = -224, TOP = 124;           // centre of the top-left square; a 40-pixel bar above holds the score
// Square codes in the list `world`. The tile costume for code n is costume n + 1.
export const EMPTY = 0, DIRT = 1, ROCK = 2, WALL = 3, GOLD = 4, CRYSTAL = 5, RUBY = 6, DIAMOND = 7, LADDER = 8;
export const VALUE = { [GOLD]: 10, [CRYSTAL]: 25, [RUBY]: 50, [DIAMOND]: 100 } as Record<number, number>;

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const tunnel = `<rect width="32" height="32" fill="#1c140f"/><circle cx="7" cy="25" r="1.5" fill="#251b14"/><circle cx="23" cy="9" r="1.2" fill="#251b14"/>`;
const dirt = `<rect width="32" height="32" fill="#7a4b2b"/>` +
  [[5, 6, 2], [20, 4, 1.5], [12, 14, 2.5], [26, 18, 2], [6, 24, 1.5], [17, 27, 2], [28, 29, 1.2]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r + 0.8}" ry="${r}" fill="#653c21"/>`).join("") +
  `<circle cx="9" cy="18" r="1" fill="#9a6a44"/><circle cx="24" cy="11" r="1" fill="#9a6a44"/>`;
const rock = tunnel +
  `<ellipse cx="16" cy="17" rx="13" ry="12" fill="#7d8089"/><ellipse cx="14" cy="14" rx="9" ry="7.5" fill="#9a9ea8"/>` +
  `<ellipse cx="11" cy="11" rx="3.5" ry="2.5" fill="#c3c7cf"/><path d="M20 22 q4 -1 6 -5" stroke="#5f626a" stroke-width="1.5" fill="none"/>`;
const wall = `<rect width="32" height="32" fill="#2e3140"/>` +
  `<path d="M0 10.5 H32 M0 21.5 H32 M10 0 V10.5 M24 10.5 V21.5 M8 21.5 V32 M26 21.5 V32" stroke="#1f2130" stroke-width="2"/>` +
  `<rect x="1" y="1" width="8" height="8" fill="#3a3e50"/><rect x="12" y="12" width="10" height="8" fill="#3a3e50"/>`;
const gem = (body: string) => dirt + body;
const gold = gem(`<path d="M8 20 l4 -7 l7 -2 l6 5 l-2 7 l-9 2 z" fill="#f2b632" stroke="#9c6a10" stroke-width="1.2"/>` +
  `<path d="M12 14 l5 -1 l-2 4 z" fill="#ffe58a"/><circle cx="21" cy="19" r="1.3" fill="#ffe58a"/>`);
const crystal = gem(`<path d="M16 5 l8 6 v10 l-8 6 l-8 -6 v-10 z" fill="#3fa7f0" stroke="#145a9c" stroke-width="1.2"/>` +
  `<path d="M16 5 v22 M8 11 l16 10 M24 11 l-16 10" stroke="#8fd3ff" stroke-width="0.8"/><path d="M11 10 l5 -3 v6 z" fill="#d6f0ff"/>`);
const ruby = gem(`<path d="M9 12 l4 -5 h6 l4 5 l-7 14 z" fill="#e0304e" stroke="#7d1024" stroke-width="1.2"/>` +
  `<path d="M9 12 h14 M13 7 l3 5 l3 -5 M16 12 v14" stroke="#ff8fa0" stroke-width="0.8"/><path d="M12 11 l2 -3 h2 z" fill="#ffd0d7"/>`);
const diamond = gem(`<path d="M7 13 l5 -6 h8 l5 6 l-9 13 z" fill="#e9fbff" stroke="#5aa9c9" stroke-width="1.2"/>` +
  `<path d="M7 13 h18 M12 7 l4 6 l4 -6 M16 13 l0 13" stroke="#9ad8ee" stroke-width="0.8"/>` +
  `<path d="M26 4 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 l3 -1 z" fill="#fff36b"/><path d="M5 22 l0.8 2 l2 0.8 l-2 0.8 l-0.8 2 l-0.8 -2 l-2 -0.8 l2 -0.8 z" fill="#ff9be6"/>`);
const ladder = tunnel + `<rect x="4" y="4" width="24" height="24" rx="4" fill="#08060a"/>` +
  `<path d="M10 2 V30 M22 2 V30 M10 8 H22 M10 15 H22 M10 22 H22 M10 29 H22" stroke="#c98d4a" stroke-width="2.5" stroke-linecap="round"/>`;

const miner = (flip: boolean) => svg(32, 32, `<g transform="${flip ? "translate(32 0) scale(-1 1)" : ""}">` +
  `<path d="M24 9 l7 -3 v8 z" fill="#fff6b0" opacity="0.8"/>` +                                        // lamp beam
  `<rect x="10" y="17" width="12" height="10" rx="3" fill="#2f6fd6"/>` +                                 // overalls
  `<rect x="11" y="26" width="4" height="5" rx="1.5" fill="#3b2a20"/><rect x="18" y="26" width="4" height="5" rx="1.5" fill="#3b2a20"/>` +
  `<circle cx="16" cy="12" r="6.5" fill="#f2c9a0"/><circle cx="18.5" cy="12" r="1.2" fill="#2a1d14"/>` +  // face
  `<path d="M8.5 10 a7.5 7 0 0 1 15 0 z" fill="#f5c518"/><rect x="7.5" y="9" width="17" height="2.5" rx="1" fill="#d9a800"/>` +
  `<circle cx="23" cy="8.5" r="2.2" fill="#fffbe0" stroke="#d9a800"/>` +                                // helmet and lamp
  `<path d="M22 19 l6 -6" stroke="#8a8f99" stroke-width="2"/><path d="M26 11 l4 4" stroke="#b8bdc6" stroke-width="2.5" stroke-linecap="round"/>` +
  `</g>`);

const backdrop = svg(480, 360, `<rect width="480" height="360" fill="#120d0a"/><rect width="480" height="40" fill="#241a14"/>` +
  `<rect y="39" width="480" height="2" fill="#3a2a1e"/>`);

export function art(P: Project) {
  const tiles = [["empty", tunnel], ["dirt", dirt], ["rock", rock], ["wall", wall], ["gold", gold], ["crystal", crystal],
    ["ruby", ruby], ["diamond", diamond], ["ladder", ladder]]
    .map(([name, body]) => P.costume(name, svg(32, 32, body), 16, 16));
  return {
    tiles,
    miner: [P.costume("right", miner(false), 16, 16), P.costume("left", miner(true), 16, 16)],
    backdrop: P.costume("mine", backdrop, 240, 180),
  };
}
