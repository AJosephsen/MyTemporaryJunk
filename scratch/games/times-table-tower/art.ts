// Artwork for Times Table Tower: four skies (day, sunset, night, space), floor blocks in every width, the crane hook,
// the ground, hearts. Original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

export const H = 28;                                 // a floor's height on the Stage
export const MIN_W = 10, MAX_W = 140, STEP = 5;      // floor widths come in steps of 5
export const widths = Array.from({ length: (MAX_W - MIN_W) / STEP + 1 }, (_, i) => MIN_W + i * STEP);

// Skies: a gradient, then something for each height band.
// The hills belong to the ground (they scroll away with it); the foundation's top is at y = 100 in this costume.
const hills = `<path d="M0 50 Q80 0 160 40 T320 30 T480 40 V110 H0z" fill="#4ade80"/><path d="M0 70 Q120 40 240 70 T480 65 V110 H0z" fill="#22c55e"/>`;
const clouds = (op: number) => [[70, 80], [300, 50], [410, 130], [180, 160]].map(([x, y]) =>
  `<g opacity="${op}" fill="#fff"><ellipse cx="${x}" cy="${y}" rx="34" ry="14"/><ellipse cx="${x + 18}" cy="${y - 9}" rx="22" ry="14"/><ellipse cx="${x - 16}" cy="${y - 4}" rx="18" ry="11"/></g>`).join("");
const stars = (n: number) => Array.from({ length: n }, (_, i) =>
  `<circle cx="${(i * 97 + 13) % 480}" cy="${(i * 61 + 7) % 360}" r="${0.7 + (i % 3) * 0.6}" fill="#fff" opacity="${0.4 + (i % 4) * 0.15}"/>`).join("");
const sky = (top: string, bottom: string, extra: string) => svg(480, 360,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#g)"/>${extra}`);
const skies: [string, string][] = [
  ["day", sky("#38bdf8", "#bae6fd", `<circle cx="410" cy="60" r="28" fill="#fde047"/>${clouds(0.9)}`)],
  ["sunset", sky("#7c3aed", "#fb923c", `<circle cx="120" cy="250" r="44" fill="#fdba74" opacity="0.9"/>${clouds(0.35)}`)],
  ["night", sky("#0f172a", "#312e81", `${stars(50)}<circle cx="380" cy="80" r="24" fill="#f8fafc"/><circle cx="370" cy="74" r="22" fill="#1e1b4b"/>`)],
  ["space", sky("#020617", "#1e1b4b", `${stars(120)}<circle cx="90" cy="110" r="30" fill="#f472b6" opacity="0.85"/>` +
    `<ellipse cx="90" cy="110" rx="50" ry="9" fill="none" stroke="#fbcfe8" stroke-width="3" opacity="0.7"/><circle cx="400" cy="270" r="16" fill="#a3e635" opacity="0.8"/>`)],
];

// A floor block of width w: a coloured slab with windows (the colour effect tints it per level).
const floor = (w: number) => svg(w + 4, H + 4,
  `<rect x="2" y="2" width="${w}" height="${H}" rx="4" fill="#f97316" stroke="#7c2d12" stroke-width="2.5"/>` +
  `<rect x="2" y="2" width="${w}" height="6" rx="3" fill="#fdba74"/>` +
  Array.from({ length: Math.floor((w - 6) / 14) }, (_, i) =>
    `<rect x="${2 + (w - Math.floor((w - 6) / 14) * 14) / 2 + i * 14 + 3}" y="${11}" width="8" height="11" rx="1.5" fill="#fef3c7" stroke="#7c2d12" stroke-width="1"/>`).join(""));

const hook = svg(40, 420,
  `<rect x="18" y="0" width="4" height="380" fill="#334155"/>` +
  `<rect x="6" y="376" width="28" height="14" rx="4" fill="#facc15" stroke="#1e293b" stroke-width="2.5"/>` +
  `<path d="M20 390 v12 q0 10 -9 10" fill="none" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>`);

const ground = svg(480, 180, hills +
  `<rect y="100" width="480" height="80" fill="#65a30d"/><rect y="100" width="480" height="10" fill="#84cc16"/>` +
  `<rect x="170" y="100" width="140" height="18" fill="#78716c" stroke="#44403c" stroke-width="2"/>`);   // the foundation

const heart = (on: boolean) => svg(36, 32,
  `<path d="M18 30 C4 20 0 13 3 7 C6 1 14 1 18 8 C22 1 30 1 33 7 C36 13 32 20 18 30z" fill="${on ? "#ef4444" : "#475569"}" stroke="#1e293b" stroke-width="2.5"/>` +
  (on ? `<ellipse cx="11" cy="10" rx="4" ry="2.5" fill="#fff" opacity="0.6"/>` : ""));

const hud = svg(480, 46, `<rect width="480" height="46" fill="#0f172a" opacity="0.55"/><rect y="44" width="480" height="2" fill="#facc15" opacity="0.8"/>`);

export function art(P: Project) {
  return {
    backdrop: skies.map(([n, s]) => P.costume(n, s, 240, 180)),
    floor: widths.map(w => P.costume(`w${w}`, floor(w), w / 2 + 2, H / 2 + 2)),
    hook: [P.costume("hook", hook, 20, 412)],               // the costume's centre is the hook's tip
    ground: [P.costume("ground", ground, 240, 100)],         // centre at the foundation's top
    heart: [P.costume("on", heart(true), 18, 16), P.costume("off", heart(false), 18, 16)],
    hud: [P.costume("hud", hud, 240, 23)],
  };
}
