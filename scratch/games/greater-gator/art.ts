// Artwork for Greater Gator: a swamp (day, sunset, night), the gator (closed, open, blinking; drawn facing right),
// lily pads, a splash ring, fireflies, hearts. Original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// The water line is at y = 200 in the backdrop (stage y = -20); reeds and trees on the far bank.
const reeds = (c: string) => [20, 46, 70, 400, 428, 452].map((x, i) =>
  `<path d="M${x} 205 Q${x + 4} ${150 - (i % 3) * 14} ${x + (i % 2 ? 10 : -6)} ${120 - (i % 3) * 12}" stroke="${c}" stroke-width="4" fill="none"/>` +
  `<ellipse cx="${x + (i % 2 ? 10 : -6)}" cy="${128 - (i % 3) * 12}" rx="4" ry="12" fill="#78350f"/>`).join("");
const trees = (c: string) => [[60, 150], [150, 135], [330, 140], [420, 150]].map(([x, y]) =>
  `<rect x="${x - 4}" y="${y}" width="8" height="${205 - y}" fill="#3f2a14"/><ellipse cx="${x}" cy="${y - 10}" rx="38" ry="30" fill="${c}"/>`).join("");
const ripples = Array.from({ length: 10 }, (_, i) =>
  `<path d="M${(i * 67 + 20) % 460} ${225 + (i * 31) % 120} q14 -5 28 0" stroke="#fff" stroke-width="2" fill="none" opacity="0.25"/>`).join("");
const swamp = (sky1: string, sky2: string, tree: string, water1: string, water2: string, extra = "") => svg(480, 360,
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient>` +
  `<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${water1}"/><stop offset="1" stop-color="${water2}"/></linearGradient></defs>` +
  `<rect width="480" height="205" fill="url(#s)"/>${extra}${trees(tree)}<rect y="200" width="480" height="160" fill="url(#w)"/>${ripples}${reeds("#4d7c0f")}`);
const swamps: [string, string][] = [
  ["day", swamp("#7dd3fc", "#d9f99d", "#4d7c0f", "#2f855a", "#14532d", `<circle cx="400" cy="50" r="24" fill="#fef08a"/>`)],
  ["sunset", swamp("#c2410c", "#fcd34d", "#365314", "#3f6212", "#1a2e05", `<circle cx="240" cy="190" r="40" fill="#fdba74"/>`)],
  ["night", swamp("#0f172a", "#1e3a5f", "#14281d", "#134e4a", "#042f2e",
    Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 480}" cy="${(i * 37) % 160}" r="1.2" fill="#fff" opacity="0.7"/>`).join("") +
    `<circle cx="90" cy="60" r="20" fill="#f1f5f9"/>`)],
];

// The gator, facing right, 170 × 90; its mouth is at the right. open: jaws apart; blink: eye closed.
const gator = (open: boolean, blink = false) => svg(180, 100,
  // tail and body
  `<path d="M4 70 Q30 52 60 58 L120 52 L120 82 L60 86 Q30 88 4 70z" fill="#4d7c0f" stroke="#1a2e05" stroke-width="3"/>` +
  [70, 86, 102].map(x => `<path d="M${x} 54 l6 -8 l6 8z" fill="#365314"/>`).join("") +
  `<ellipse cx="96" cy="84" rx="12" ry="6" fill="#365314"/><ellipse cx="62" cy="86" rx="10" ry="5" fill="#365314"/>` +
  // head with upper and lower jaw
  (open
    ? `<path d="M112 50 L176 22 L172 34 L118 62z" fill="#65a30d" stroke="#1a2e05" stroke-width="3"/>` +
      `<path d="M112 82 L176 92 L172 80 L118 70z" fill="#65a30d" stroke="#1a2e05" stroke-width="3"/>` +
      `<path d="M118 62 L172 34 L172 80 L118 70z" fill="#be123c"/>` +
      [130, 142, 154, 166].map((x, i) => `<path d="M${x} ${57 - i * 6} l4 7 l4 -8z" fill="#fff"/><path d="M${x} ${73 + i * 2} l4 -7 l4 7z" fill="#fff"/>`).join("")
    : `<path d="M112 50 Q150 46 176 60 Q178 70 172 74 L112 82z" fill="#65a30d" stroke="#1a2e05" stroke-width="3"/>` +
      `<path d="M116 72 L172 70" stroke="#1a2e05" stroke-width="2.5"/>` +
      [128, 140, 152, 164].map(x => `<path d="M${x} 70 l3 5 l3 -5z" fill="#fff"/>`).join("")) +
  // eye on top of the head
  `<circle cx="124" cy="${open ? 46 : 48}" r="11" fill="#65a30d" stroke="#1a2e05" stroke-width="3"/>` +
  (blink ? `<path d="M116 ${open ? 46 : 48} h16" stroke="#1a2e05" stroke-width="3"/>`
    : `<circle cx="126" cy="${open ? 45 : 47}" r="6" fill="#fef9c3"/><circle cx="128" cy="${open ? 45 : 47}" r="3" fill="#0f172a"/>`) +
  `<circle cx="168" cy="${open ? 28 : 58}" r="2" fill="#1a2e05"/>`);

const pad = (flower: string) => svg(110, 60,
  `<ellipse cx="55" cy="34" rx="52" ry="24" fill="#16a34a" stroke="#14532d" stroke-width="3"/>` +
  `<path d="M55 34 L98 18 L104 30z" fill="#14532d"/>` +   // the notch
  `<ellipse cx="55" cy="30" rx="40" ry="14" fill="#22c55e" opacity="0.6"/>` +
  (flower ? `<g transform="translate(14 22)">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-6" rx="4" ry="7" fill="${flower}" transform="rotate(${a})"/>`).join("")}<circle r="3" fill="#fde047"/></g>` : ""));
const splash = svg(80, 30, `<ellipse cx="40" cy="15" rx="36" ry="11" fill="none" stroke="#e0f2fe" stroke-width="3" opacity="0.8"/>`);
const firefly = svg(16, 16, `<circle cx="8" cy="8" r="7" fill="#fde047" opacity="0.35"/><circle cx="8" cy="8" r="3" fill="#fef9c3"/>`);
const heart = (on: boolean) => svg(36, 32,
  `<path d="M18 30 C4 20 0 13 3 7 C6 1 14 1 18 8 C22 1 30 1 33 7 C36 13 32 20 18 30z" fill="${on ? "#ef4444" : "#475569"}" stroke="#1e293b" stroke-width="2.5"/>` +
  (on ? `<ellipse cx="11" cy="10" rx="4" ry="2.5" fill="#fff" opacity="0.6"/>` : ""));
const hud = svg(480, 46, `<rect width="480" height="46" fill="#052e16" opacity="0.6"/><rect y="44" width="480" height="2" fill="#a3e635" opacity="0.8"/>`);
const flash = (c: string) => svg(480, 360, `<rect width="480" height="360" fill="${c}"/>`);

export function art(P: Project) {
  return {
    backdrop: swamps.map(([n, s]) => P.costume(n, s, 240, 180)),
    gator: [P.costume("closed", gator(false), 110, 66), P.costume("open", gator(true), 110, 66), P.costume("blink", gator(false, true), 110, 66)],
    pad: [P.costume("pink", pad("#f9a8d4"), 55, 34), P.costume("white", pad("#f8fafc"), 55, 34), P.costume("plain", pad(""), 55, 34)],
    splash: [P.costume("splash", splash, 40, 15)],
    firefly: [P.costume("firefly", firefly, 8, 8)],
    heart: [P.costume("on", heart(true), 18, 16), P.costume("off", heart(false), 18, 16)],
    hud: [P.costume("hud", hud, 240, 23)],
    flash: [P.costume("white", flash("#fff"), 240, 180), P.costume("red", flash("#ef4444"), 240, 180)],
  };
}
