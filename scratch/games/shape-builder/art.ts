// Shapes and pictures for Shape Builder. Every shape is a polygon in units (U px) around its rotation centre, drawn
// pointing "up" (direction 0). A picture is a list of slots: a shape at a place, turned `dir` degrees clockwise, in a
// colour (a colour-effect value). Pieces and slot outlines are the same polygons, so a piece fits its outline exactly.
import type { Project } from "../../lib/sb3.ts";

export const U = 20;
type Pt = [number, number];
// sym: the smallest turn that looks the same (a square looks the same after 90°, a rectangle after 180°).
export const SHAPES: Record<string, { pts: Pt[]; sym: number; arc?: boolean }> = {
  sq:   { pts: [[-1, -1], [1, -1], [1, 1], [-1, 1]], sym: 90 },
  rect: { pts: [[-2, -1], [2, -1], [2, 1], [-2, 1]], sym: 180 },
  tri:  { pts: [[-1, -1], [1, -1], [-1, 1]], sym: 360 },                       // right angle bottom-left
  iso:  { pts: [[-2, -1], [2, -1], [0, 1]], sym: 360 },
  ell:  { pts: [[-2, -2], [2, -2], [2, 0], [0, 0], [0, 2], [-2, 2]], sym: 360 }, // an L of three squares
  para: { pts: [[-2, -1], [1, -1], [2, 1], [-1, 1]], sym: 180 },
  trap: { pts: [[-2, -1], [2, -1], [3, 1], [-3, 1]], sym: 360 },              // wider at the top (a boat's hull)
  semi: { pts: [[-2, -1], [2, -1]], sym: 360, arc: true },                    // half a disc, flat side down
};
export const SHAPE_NAMES = Object.keys(SHAPES);

// Slots: [shape, x, y, dir, colour]. Colour-effect values: 0 red, 15 orange, 30 yellow, 70 green, 110 blue, 150 purple.
type Slot = [string, number, number, number, number];
export const PICTURES: { name: string; slots: Slot[] }[] = [
  { name: "house", slots: [["iso", 0, 50, 0, 0], ["rect", 0, 10, 0, 30], ["rect", 0, -30, 0, 30], ["sq", -60, -30, 0, 110], ["tri", -60, 10, 270, 70]] },
  { name: "rocket", slots: [["tri", -20, 70, 270, 0], ["tri", 20, 70, 0, 0], ["rect", 0, 30, 0, 110], ["rect", 0, -10, 0, 110],
    ["tri", -60, -10, 270, 150], ["tri", 60, -10, 0, 150], ["iso", 0, -50, 180, 15]] },
  { name: "boat", slots: [["trap", 0, -50, 0, 15], ["iso", -20, 10, 270, 0], ["iso", 20, 10, 90, 30], ["tri", 20, 70, 0, 70],
    ["sq", 110, 80, 45, 30], ["para", -60, -100, 0, 110], ["para", 60, -100, 0, 110]] },
  { name: "fish", slots: [["sq", 0, 0, 45, 15], ["iso", -48, 0, 90, 0], ["sq", 60, 50, 45, 110], ["semi", -70, -90, 0, 70], ["semi", 70, -90, 0, 70]] },
  { name: "cat", slots: [["rect", 0, 20, 0, 15], ["tri", -20, 60, 0, 15], ["tri", 20, 60, 270, 15], ["sq", -20, -20, 0, 30], ["sq", 20, -20, 0, 30],
    ["ell", 80, -40, 90, 150]] },
  { name: "tree", slots: [["sq", 0, -80, 0, 15], ["iso", 0, -40, 0, 70], ["iso", 0, 0, 0, 70], ["iso", 0, 40, 0, 70], ["sq", 0, 88, 45, 30],
    ["semi", -110, -80, 0, 110], ["semi", 110, -80, 0, 110]] },
];

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
// The shape's outline as an SVG path, centred in a box of half-size `r` (y down).
export function shapePath(name: string, r: number) {
  const s = SHAPES[name];
  const p = s.pts.map(([x, y]) => [r + x * U, r - y * U]);
  if (s.arc) return `M${p[0][0]} ${p[0][1]} A${2 * U} ${2 * U} 0 0 1 ${p[1][0]} ${p[1][1]} Z`;
  return `M${p.map(q => q.join(" ")).join(" L")} Z`;
}
const R = 3 * U + 6;   // every costume is the same square, so the rotation centre is its middle
const piece = (name: string) => svg(2 * R, 2 * R,
  `<path d="${shapePath(name, R)}" fill="#ef4444" stroke="#7f1d1d" stroke-width="3" stroke-linejoin="round"/>` +
  `<path d="${shapePath(name, R)}" fill="none" stroke="#fff" stroke-width="2" opacity="0.35" transform="translate(-1.5 -1.5)"/>`);
const outline = (name: string) => svg(2 * R, 2 * R,
  `<path d="${shapePath(name, R)}" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-width="3" stroke-dasharray="7 5" stroke-linejoin="round"/>`);
const shadow = (name: string) => svg(2 * R, 2 * R, `<path d="${shapePath(name, R)}" fill="#000" opacity="0.3"/>`);

// The board: a blueprint grid.
const grid = Array.from({ length: 25 }, (_, i) => `<path d="M${i * 20} 0 V360" stroke="#93c5fd" stroke-width="${i % 2 ? 0.5 : 1}" opacity="0.25"/>`).join("") +
  Array.from({ length: 19 }, (_, i) => `<path d="M0 ${i * 20} H480" stroke="#93c5fd" stroke-width="${i % 2 ? 0.5 : 1}" opacity="0.25"/>`).join("");
const backdrop = (top: string, bottom: string) => svg(480, 360,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#g)"/>${grid}` +
  `<rect x="0" y="316" width="480" height="44" fill="#0f172a" opacity="0.45"/>`);   // the button tray

const button = (icon: string, fill: string) => svg(76, 40,
  `<rect x="2" y="2" width="72" height="36" rx="12" fill="${fill}" stroke="#0f172a" stroke-width="3"/>` +
  `<rect x="6" y="5" width="64" height="10" rx="5" fill="#fff" opacity="0.25"/>${icon}`);
// Turn arrows: a curved arrow, clockwise or not, at the left of the button (the label is written by the font).
const arrow = (cw: boolean) => `<g transform="translate(${cw ? 58 : 18} 20) scale(${cw ? 1 : -1} 1)"><path d="M-8 4 A9 9 0 1 1 6 -6" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>` +
  `<path d="M2 -12 L10 -5 L1 -1 z" fill="#fff"/></g>`;
const heart = (on: boolean) => svg(36, 32,
  `<path d="M18 30 C4 20 0 13 3 7 C6 1 14 1 18 8 C22 1 30 1 33 7 C36 13 32 20 18 30z" fill="${on ? "#ef4444" : "#475569"}" stroke="#1e293b" stroke-width="2.5"/>` +
  (on ? `<ellipse cx="11" cy="10" rx="4" ry="2.5" fill="#fff" opacity="0.6"/>` : ""));
const hud = svg(480, 46, `<rect width="480" height="46" fill="#0f172a" opacity="0.6"/><rect y="44" width="480" height="2" fill="#fbbf24" opacity="0.8"/>`);
const flash = (c: string) => svg(480, 360, `<rect width="480" height="360" fill="${c}"/>`);

export function art(P: Project) {
  return {
    backdrop: [P.costume("blueprint", backdrop("#1e3a8a", "#172554"), 240, 180), P.costume("night", backdrop("#312e81", "#0f0a2e"), 240, 180),
      P.costume("sunset", backdrop("#9a3412", "#4c1d95"), 240, 180)],
    // Piece and slot costumes: "<shape>", "o-<shape>" (outline), "s-<shape>" (shadow).
    shape: SHAPE_NAMES.flatMap(n => [P.costume(n, piece(n), R, R), P.costume(`o-${n}`, outline(n), R, R), P.costume(`s-${n}`, shadow(n), R, R)]),
    button: [P.costume("ccw", button(arrow(false), "#2563eb"), 38, 20), P.costume("cw", button(arrow(true), "#2563eb"), 38, 20),
      P.costume("drop", button("", "#16a34a"), 38, 20), P.costume("choice", button("", "#7c3aed"), 38, 20)],
    heart: [P.costume("on", heart(true), 18, 16), P.costume("off", heart(false), 18, 16)],
    hud: [P.costume("hud", hud, 240, 23)],
    flash: [P.costume("white", flash("#fff"), 240, 180), P.costume("red", flash("#ef4444"), 240, 180)],
  };
}

// A preview of every picture as one SVG (for checking the geometry): node art.ts > preview.svg
if (import.meta.url === `file://${process.argv[1]}`) {
  const hue = (c: number) => `hsl(${(c / 200) * 360} 80% 55%)`;
  const cells = PICTURES.map((p, i) => {
    const ox = (i % 3) * 320 + 160, oy = Math.floor(i / 3) * 280 + 140;
    return `<rect x="${ox - 155}" y="${oy - 135}" width="310" height="270" fill="#1e3a8a"/><text x="${ox - 150}" y="${oy - 118}" fill="#fff" font-size="14">${p.name}</text>` +
      p.slots.map(([s, x, y, dir, c]) => `<path d="${shapePath(s, 0)}" transform="translate(${ox + x} ${oy - y}) rotate(${dir})" fill="${hue(c)}" stroke="#111" stroke-width="2"/>`).join("");
  }).join("");
  console.log(svg(960, 560, cells));
}
