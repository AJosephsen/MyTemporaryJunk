// Artwork for Number Blaster: space backdrop with a city, meteor, answer pads, laser, flash, shields, stars. Original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const city = (() => {
  const out: string[] = [];
  let x = 0, i = 0;
  while (x < 480) {
    const w = 26 + ((i * 37) % 30), h = 40 + ((i * 53) % 55);
    out.push(`<rect x="${x}" y="${360 - h}" width="${w}" height="${h}" fill="${i % 2 ? "#1e1b4b" : "#272363"}"/>`);
    for (let wy = 360 - h + 8; wy < 350; wy += 12) for (let wx = x + 5; wx < x + w - 6; wx += 9)
      if ((wx * 7 + wy * 3 + i) % 5 < 2) out.push(`<rect x="${wx}" y="${wy}" width="4" height="5" fill="#fde68a" opacity="0.8"/>`);
    x += w + 2; i++;
  }
  return out.join("");
})();
const backdrop = svg(480, 360,
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05051a"/><stop offset="0.7" stop-color="#1b1446"/><stop offset="1" stop-color="#3b1d5e"/></linearGradient>` +
  `<radialGradient id="p" cx="0.35" cy="0.35"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#1e40af"/></radialGradient></defs>` +
  `<rect width="480" height="360" fill="url(#s)"/><circle cx="395" cy="95" r="34" fill="url(#p)"/>` +
  `<ellipse cx="395" cy="95" rx="54" ry="10" fill="none" stroke="#bae6fd" stroke-width="3" opacity="0.6"/>` +
  `<rect y="270" width="480" height="4" fill="#38bdf8" opacity="0.35"/>` + city);   // the shield line at y = -95

const meteor = svg(132, 112,
  `<path d="M40 70 C30 40 50 30 46 4 C62 22 70 10 72 0 C80 20 96 14 92 40 C104 30 100 52 92 70 z" fill="#f97316" opacity="0.9"/>` +
  `<path d="M52 70 C46 50 58 40 58 22 C66 34 74 28 76 18 C80 34 88 36 84 52 C90 50 88 62 82 72 z" fill="#fde047"/>` +
  `<path d="M14 76 Q12 52 40 48 Q66 40 96 48 Q124 54 120 80 Q118 104 88 108 Q60 112 32 106 Q8 100 14 76 z" fill="#5b4636" stroke="#2b1d12" stroke-width="3"/>` +
  `<ellipse cx="66" cy="80" rx="44" ry="20" fill="#2b2140" opacity="0.85"/>` +   // a dark plate for the sum
  `<circle cx="26" cy="64" r="4" fill="#3f2f22"/><circle cx="104" cy="94" r="5" fill="#3f2f22"/>`);
const pad = (fill: string, glow: string) => svg(100, 64,
  `<rect x="4" y="6" width="92" height="54" rx="14" fill="#0b1026" opacity="0.6"/>` +
  `<rect x="2" y="2" width="96" height="54" rx="14" fill="${fill}" stroke="${glow}" stroke-width="4"/>` +
  `<rect x="10" y="7" width="80" height="12" rx="6" fill="#ffffff" opacity="0.15"/>`);
const beam = svg(100, 16, `<rect x="0" y="3" width="100" height="10" rx="5" fill="#67e8f9" opacity="0.9"/><rect x="0" y="6" width="100" height="4" rx="2" fill="#ecfeff"/>`);
const flash = (c: string) => svg(480, 360, `<rect width="480" height="360" fill="${c}"/>`);
const shield = (ok: boolean) => svg(34, 38, `<path d="M17 2 L32 8 V18 C32 28 24 34 17 37 C10 34 2 28 2 18 V8 z" fill="${ok ? "#38bdf8" : "#334155"}" stroke="${ok ? "#e0f2fe" : "#64748b"}" stroke-width="2.5"/>` +
  (ok ? `<path d="M10 12 L17 9 V30 C12 27 10 23 10 18 z" fill="#ffffff" opacity="0.35"/>` : `<path d="M10 10 L20 20 L14 24 L24 32" stroke="#94a3b8" stroke-width="2" fill="none"/>`));
// The score bar across the top: meteors come out from behind it.
const hud = svg(480, 46, `<defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b24"/><stop offset="1" stop-color="#16123a"/></linearGradient></defs>` +
  `<rect width="480" height="42" fill="url(#h)" opacity="0.94"/><rect y="40" width="480" height="3" fill="#7c3aed"/><rect y="43" width="480" height="3" fill="#7c3aed" opacity="0.35"/>`);
const star = svg(6, 6, `<circle cx="3" cy="3" r="2.2" fill="#ffffff"/>`);

export function art(P: Project) {
  return {
    backdrop: P.costume("space", backdrop, 240, 180),
    meteor: [P.costume("meteor", meteor, 66, 80)],
    pad: [P.costume("pad", pad("#1e3a8a", "#60a5fa"), 50, 30), P.costume("good", pad("#166534", "#86efac"), 50, 30),
      P.costume("bad", pad("#7f1d1d", "#fca5a5"), 50, 30)],
    laser: [P.costume("beam", beam, 0, 8)],
    flash: [P.costume("white", flash("#ffffff"), 240, 180), P.costume("red", flash("#ef4444"), 240, 180)],
    shield: [P.costume("ok", shield(true), 17, 19), P.costume("lost", shield(false), 17, 19)],
    star: [P.costume("star", star, 3, 3)],
    hud: [P.costume("bar", hud, 240, 23)],
  };
}
