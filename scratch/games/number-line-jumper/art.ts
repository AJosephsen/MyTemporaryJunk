// Artwork for Number Line Jumper: a pond (morning, afternoon, dusk), small lily pads for the number line, the frog
// (sitting, leaping; facing right), a fly, the jump sign, highlight rings, timer beads, hearts. Original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// The water starts at y = 150 in the backdrop (stage y = 30).
const bank = (c: string) => `<path d="M0 150 Q60 120 130 140 T260 135 T400 140 T480 130 V160 H0z" fill="${c}"/>`;
const reeds = [18, 34, 446, 462].map((x, i) => `<path d="M${x} 152 Q${x + 3} 100 ${x + (i % 2 ? 6 : -4)} ${80 + i * 6}" stroke="#3f6212" stroke-width="3" fill="none"/>` +
  `<ellipse cx="${x + (i % 2 ? 6 : -4)}" cy="${88 + i * 6}" rx="3" ry="9" fill="#78350f"/>`).join("");
const ripples = Array.from({ length: 12 }, (_, i) =>
  `<path d="M${(i * 71 + 15) % 460} ${175 + (i * 29) % 170} q12 -4 24 0" stroke="#fff" stroke-width="2" fill="none" opacity="0.2"/>`).join("");
const pond = (sky1: string, sky2: string, land: string, w1: string, w2: string, extra = "") => svg(480, 360,
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient>` +
  `<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${w1}"/><stop offset="1" stop-color="${w2}"/></linearGradient></defs>` +
  `<rect width="480" height="160" fill="url(#s)"/>${extra}${bank(land)}<rect y="150" width="480" height="210" fill="url(#w)"/>${ripples}${reeds}`);
const ponds: [string, string][] = [
  ["morning", pond("#93c5fd", "#e0f2fe", "#65a30d", "#0ea5e9", "#0c4a6e", `<circle cx="70" cy="70" r="20" fill="#fef3c7"/>`)],
  ["afternoon", pond("#38bdf8", "#fde68a", "#4d7c0f", "#0284c7", "#082f49", `<circle cx="400" cy="60" r="22" fill="#fde047"/>`)],
  ["dusk", pond("#4c1d95", "#f97316", "#365314", "#1e3a8a", "#020617", `<circle cx="240" cy="140" r="30" fill="#fdba74" opacity="0.8"/>`)],
];

const pad = svg(36, 22, `<ellipse cx="18" cy="12" rx="16" ry="9" fill="#16a34a" stroke="#14532d" stroke-width="2"/>` +
  `<path d="M18 12 L32 6 L34 11z" fill="#14532d"/><ellipse cx="17" cy="10" rx="10" ry="4" fill="#4ade80" opacity="0.5"/>`);
// The frog, side view facing right, 44 × 36. leap: stretched out, legs back.
const frog = (leap: boolean) => leap
  ? svg(56, 34, `<path d="M4 26 L16 20 L12 30z" fill="#15803d"/><ellipse cx="30" cy="18" rx="20" ry="10" fill="#22c55e" stroke="#14532d" stroke-width="2.5"/>` +
    `<ellipse cx="34" cy="22" rx="12" ry="5" fill="#bbf7d0"/><circle cx="44" cy="9" r="6" fill="#22c55e" stroke="#14532d" stroke-width="2.5"/>` +
    `<circle cx="45" cy="8" r="3" fill="#0f172a"/><path d="M42 26 L52 30" stroke="#15803d" stroke-width="4" stroke-linecap="round"/>`)
  : svg(44, 36, `<ellipse cx="20" cy="24" rx="17" ry="11" fill="#22c55e" stroke="#14532d" stroke-width="2.5"/>` +
    `<ellipse cx="23" cy="28" rx="10" ry="5" fill="#bbf7d0"/><path d="M6 30 Q2 34 10 34 L18 32" fill="#15803d" stroke="#14532d" stroke-width="2"/>` +
    `<circle cx="28" cy="12" r="7" fill="#22c55e" stroke="#14532d" stroke-width="2.5"/><circle cx="30" cy="11" r="3.5" fill="#0f172a"/>` +
    `<circle cx="31" cy="10" r="1.2" fill="#fff"/><path d="M30 22 Q36 24 40 21" stroke="#14532d" stroke-width="2" fill="none"/>`);
const fly = (up: boolean) => svg(20, 16, `<ellipse cx="7" cy="${up ? 4 : 6}" rx="6" ry="3" fill="#e0f2fe" opacity="0.8"/>` +
  `<ellipse cx="13" cy="${up ? 4 : 6}" rx="6" ry="3" fill="#e0f2fe" opacity="0.8"/><ellipse cx="10" cy="10" rx="5" ry="4" fill="#1e293b"/>`);
const sign = svg(150, 70, `<rect x="71" y="50" width="8" height="20" fill="#78350f"/>` +
  `<rect x="3" y="3" width="144" height="52" rx="10" fill="#a16207" stroke="#451a03" stroke-width="4"/><rect x="10" y="9" width="130" height="8" rx="4" fill="#fde68a" opacity="0.35"/>`);
const ring = (c: string) => svg(40, 26, `<ellipse cx="20" cy="13" rx="18" ry="11" fill="none" stroke="${c}" stroke-width="3.5"/>`);
const bead = (on: boolean) => svg(14, 14, `<circle cx="7" cy="7" r="6" fill="${on ? "#facc15" : "#334155"}" stroke="#0f172a" stroke-width="1.5"/>`);
const heart = (on: boolean) => svg(36, 32,
  `<path d="M18 30 C4 20 0 13 3 7 C6 1 14 1 18 8 C22 1 30 1 33 7 C36 13 32 20 18 30z" fill="${on ? "#ef4444" : "#475569"}" stroke="#1e293b" stroke-width="2.5"/>` +
  (on ? `<ellipse cx="11" cy="10" rx="4" ry="2.5" fill="#fff" opacity="0.6"/>` : ""));
const hud = svg(480, 46, `<rect width="480" height="46" fill="#082f49" opacity="0.6"/><rect y="44" width="480" height="2" fill="#4ade80" opacity="0.8"/>`);
const flash = (c: string) => svg(480, 360, `<rect width="480" height="360" fill="${c}"/>`);

export function art(P: Project) {
  return {
    backdrop: ponds.map(([n, s]) => P.costume(n, s, 240, 180)),
    pad: [P.costume("pad", pad, 18, 12)],
    frog: [P.costume("sit", frog(false), 22, 34), P.costume("leap", frog(true), 30, 30)],   // centre at the feet
    fly: [P.costume("up", fly(true), 10, 8), P.costume("down", fly(false), 10, 8)],
    sign: [P.costume("sign", sign, 75, 29)],
    ring: [P.costume("cursor", ring("#fde047"), 20, 13), P.costume("right", ring("#4ade80"), 20, 13), P.costume("wrong", ring("#ef4444"), 20, 13)],
    bead: [P.costume("on", bead(true), 7, 7), P.costume("off", bead(false), 7, 7)],
    heart: [P.costume("on", heart(true), 18, 16), P.costume("off", heart(false), 18, 16)],
    hud: [P.costume("hud", hud, 240, 23)],
    flash: [P.costume("white", flash("#fff"), 240, 180), P.costume("red", flash("#ef4444"), 240, 180)],
  };
}
