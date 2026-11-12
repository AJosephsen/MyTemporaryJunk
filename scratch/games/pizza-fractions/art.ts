// Artwork for Pizza Fractions: a pizzeria (day, evening, night), pizza slices for every cut (plain and with
// pepperoni), a wooden board, four animal customers in three moods, the order bubble, the SERVE button. Original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

export const CUTS = [2, 3, 4, 5, 6, 8, 9, 10, 12];   // every cut an order can need (b × k)
export const R = 90;   // a pizza's radius at size 100

// The pizzeria: tiles, an oven, a counter along the bottom (its top at y = 230 in the backdrop, stage y = -50... the
// pizzas sit on it).
const tiles = (a: string, b: string) => Array.from({ length: 12 * 6 }, (_, i) =>
  `<rect x="${(i % 12) * 40}" y="${Math.floor(i / 12) * 40}" width="40" height="40" fill="${(i + Math.floor(i / 12)) % 2 ? a : b}"/>`).join("");
const oven = `<path d="M330 150 V90 A70 60 0 0 1 470 90 V150z" fill="#7c2d12"/><path d="M350 150 V100 A50 42 0 0 1 450 100 V150z" fill="#1c1917"/>` +
  `<path d="M362 150 Q380 120 400 140 Q412 118 438 150z" fill="#f97316"/><path d="M372 150 Q388 132 400 146 Q414 130 428 150z" fill="#fde047"/>`;
const counter = (top: string, front: string) => `<rect y="150" width="480" height="12" fill="${top}"/><rect y="162" width="480" height="198" fill="${front}"/>` +
  Array.from({ length: 8 }, (_, i) => `<rect x="${i * 60 + 4}" y="170" width="52" height="190" fill="#000" opacity="0.06"/>`).join("");
const neon = `<text x="40" y="70" font-family="Arial Black, Arial" font-size="34" fill="none" stroke="#f0abfc" stroke-width="3">PIZZA</text>`;
const shop = (a: string, b: string, top: string, front: string, extra = "") => svg(480, 360, tiles(a, b) + extra + oven + counter(top, front));
const shops: [string, string][] = [
  ["day", shop("#fef3c7", "#fde68a", "#e7e5e4", "#b45309")],
  ["evening", shop("#fed7aa", "#fdba74", "#d6d3d1", "#92400e")],
  ["night", shop("#312e81", "#3730a3", "#a8a29e", "#451a03", neon)],
];

// One slice: a wedge from straight up, clockwise by 360/d degrees. Topped slices have pepperoni and basil.
const C = R + 6;
const pol = (r: number, deg: number) => [C + r * Math.sin(deg * Math.PI / 180), C - r * Math.cos(deg * Math.PI / 180)];
function slice(d: number, topped: boolean) {
  const A = 360 / d, [x1, y1] = pol(R, A), [cx1, cy1] = pol(R - 9, A);
  const wedge = (r: number) => { const [ax, ay] = pol(r, A); return `M${C} ${C} L${C} ${C - r} A${r} ${r} 0 ${A > 180 ? 1 : 0} 1 ${ax} ${ay} Z`; };
  let tops = "";
  if (topped) {
    const fr = A < 60 ? [0.5] : A < 120 ? [0.28, 0.72] : [0.2, 0.5, 0.8];
    for (const rr of A < 45 ? [0.6] : [0.42, 0.72]) for (const f of fr) {
      const [px, py] = pol(R * rr, A * f);
      tops += `<circle cx="${px}" cy="${py}" r="9" fill="#b91c1c" stroke="#7f1d1d" stroke-width="1.5"/><circle cx="${px - 2}" cy="${py - 2}" r="2.5" fill="#fca5a5" opacity="0.6"/>`;
    }
    const [bx, by] = pol(R * 0.28, A * 0.5);
    tops += `<ellipse cx="${bx}" cy="${by}" rx="5" ry="3" fill="#16a34a" transform="rotate(${A * 0.5} ${bx} ${by})"/>`;
  }
  void x1; void y1; void cx1; void cy1;
  return svg(2 * C, 2 * C,
    `<path d="${wedge(R)}" fill="#d97706" stroke="#78350f" stroke-width="2" stroke-linejoin="round"/>` +     // crust
    `<path d="${wedge(R - 9)}" fill="#dc2626"/>` +                                                          // sauce rim
    `<path d="${wedge(R - 13)}" fill="#fcd34d"/>` + tops);
}
const board = svg(2 * C + 30, 2 * C + 30, `<circle cx="${C + 15}" cy="${C + 15}" r="${R + 14}" fill="#a16207" stroke="#713f12" stroke-width="4"/>` +
  `<circle cx="${C + 15}" cy="${C + 15}" r="${R + 6}" fill="none" stroke="#ca8a04" stroke-width="2" opacity="0.6"/>`);

// Customers, 100 × 130: an animal head on a body in an apron. Moods: happy, wait, cross.
type Kind = { name: string; fur: string; ears: string };
const KINDS: Kind[] = [
  { name: "cat", fur: "#fb923c", ears: `<path d="M22 30 L30 4 L44 24z M78 30 L70 4 L56 24z" fill="#fb923c" stroke="#7c2d12" stroke-width="2.5"/>` },
  { name: "bear", fur: "#a16207", ears: `<circle cx="24" cy="18" r="11" fill="#a16207" stroke="#422006" stroke-width="2.5"/><circle cx="76" cy="18" r="11" fill="#a16207" stroke="#422006" stroke-width="2.5"/>` },
  { name: "bunny", fur: "#f1f5f9", ears: `<ellipse cx="36" cy="0" rx="8" ry="24" fill="#f1f5f9" stroke="#475569" stroke-width="2.5"/><ellipse cx="64" cy="0" rx="8" ry="24" fill="#f1f5f9" stroke="#475569" stroke-width="2.5"/>` },
  { name: "pig", fur: "#f9a8d4", ears: `<path d="M24 24 L22 6 L40 18z M76 24 L78 6 L60 18z" fill="#f9a8d4" stroke="#9d174d" stroke-width="2.5"/>` },
];
const MOODS = ["happy", "wait", "cross"];
const customer = (k: Kind, mood: string) => svg(100, 140,
  `<g transform="translate(0 20)">` +
  `<path d="M18 120 Q18 78 50 78 Q82 78 82 120z" fill="${k.fur}" stroke="#1f2937" stroke-width="2.5"/>` +          // body
  `<path d="M32 120 L34 90 H66 L68 120z" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>` +                      // apron
  k.ears + `<circle cx="50" cy="44" r="34" fill="${k.fur}" stroke="#1f2937" stroke-width="2.5"/>` +
  (k.name === "pig" ? `<ellipse cx="50" cy="54" rx="11" ry="8" fill="#f472b6" stroke="#9d174d" stroke-width="2"/><circle cx="46" cy="54" r="2" fill="#831843"/><circle cx="54" cy="54" r="2" fill="#831843"/>` : "") +
  (k.name === "cat" ? `<path d="M30 52 H16 M30 56 H18 M70 52 H84 M70 56 H82" stroke="#7c2d12" stroke-width="1.5"/>` : "") +
  // eyes and brows
  (mood === "cross" ? `<path d="M30 30 L44 36 M70 30 L56 36" stroke="#1f2937" stroke-width="3"/>` : "") +
  `<circle cx="38" cy="42" r="${mood === "happy" ? 5 : 4}" fill="#1f2937"/><circle cx="62" cy="42" r="${mood === "happy" ? 5 : 4}" fill="#1f2937"/>` +
  `<circle cx="39" cy="40" r="1.5" fill="#fff"/><circle cx="63" cy="40" r="1.5" fill="#fff"/>` +
  // mouth
  (mood === "happy" ? `<path d="M38 62 Q50 74 62 62" fill="#be123c" stroke="#1f2937" stroke-width="2.5"/>`
    : mood === "wait" ? `<path d="M40 66 H60" stroke="#1f2937" stroke-width="3"/>`
    : `<path d="M38 70 Q50 60 62 70" fill="none" stroke="#1f2937" stroke-width="3"/><circle cx="28" cy="56" r="5" fill="#ef4444" opacity="0.5"/><circle cx="72" cy="56" r="5" fill="#ef4444" opacity="0.5"/>`) +
  `</g>`);

// The order bubble: room for a stacked fraction, with its bar.
const bubble = svg(120, 110, `<path d="M10 10 H110 V86 H96 L104 106 L78 86 H10z" fill="#fff" stroke="#1f2937" stroke-width="3" stroke-linejoin="round"/>` +
  `<rect x="34" y="46" width="52" height="5" rx="2.5" fill="#1f2937"/>`);
const serve = svg(120, 46, `<rect x="2" y="2" width="116" height="42" rx="14" fill="#16a34a" stroke="#14532d" stroke-width="3"/><rect x="8" y="6" width="104" height="10" rx="5" fill="#fff" opacity="0.25"/>`);
const bead = (on: boolean) => svg(14, 14, `<circle cx="7" cy="7" r="6" fill="${on ? "#facc15" : "#334155"}" stroke="#0f172a" stroke-width="1.5"/>`);
const heart = (on: boolean) => svg(36, 32,
  `<path d="M18 30 C4 20 0 13 3 7 C6 1 14 1 18 8 C22 1 30 1 33 7 C36 13 32 20 18 30z" fill="${on ? "#ef4444" : "#475569"}" stroke="#1e293b" stroke-width="2.5"/>` +
  (on ? `<ellipse cx="11" cy="10" rx="4" ry="2.5" fill="#fff" opacity="0.6"/>` : ""));
const hud = svg(480, 46, `<rect width="480" height="46" fill="#431407" opacity="0.65"/><rect y="44" width="480" height="2" fill="#fbbf24" opacity="0.8"/>`);
const flash = (c: string) => svg(480, 360, `<rect width="480" height="360" fill="${c}"/>`);

export function art(P: Project) {
  return {
    backdrop: shops.map(([n, s]) => P.costume(n, s, 240, 180)),
    slice: CUTS.flatMap(d => [P.costume(`w${d}`, slice(d, false), C, C), P.costume(`t${d}`, slice(d, true), C, C)]),
    board: [P.costume("board", board, C + 15, C + 15)],
    customer: KINDS.flatMap(k => MOODS.map(m => P.costume(`${k.name}-${m}`, customer(k, m), 50, 70))),
    kinds: KINDS.map(k => k.name),
    bubble: [P.costume("bubble", bubble, 60, 48)],
    serve: [P.costume("serve", serve, 60, 23)],
    bead: [P.costume("on", bead(true), 7, 7), P.costume("off", bead(false), 7, 7)],
    heart: [P.costume("on", heart(true), 18, 16), P.costume("off", heart(false), 18, 16)],
    hud: [P.costume("hud", hud, 240, 23)],
    flash: [P.costume("white", flash("#fff"), 240, 180), P.costume("red", flash("#ef4444"), 240, 180)],
  };
}
