// Artwork for Chain Spark (the tutorial): a night lake with a city, three fireworks (rocket, shell, fountain), sparks,
// the match. Every spark has the same bright yellow core: SPARK_CORE. A firework that touches that colour goes off, so
// nothing else may use it (the city's windows are a different yellow).
import type { Project } from "../../lib/sb3.ts";

export const SPARK_CORE = "#ffe14d";
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// The night: sky, stars, a city along the shore (its top near stage y = -110), the lake, the tray along the bottom.
const stars = Array.from({ length: 45 }, (_, i) =>
  `<circle cx="${(i * 83 + 19) % 480}" cy="${(i * 47 + 9) % 180}" r="${0.7 + (i % 3) * 0.4}" fill="#fff" opacity="${0.4 + (i % 4) * 0.12}"/>`).join("");
const city = (() => {
  const out: string[] = []; let x = 0, i = 0;
  while (x < 480) {
    const w = 22 + ((i * 29) % 26), h = 26 + ((i * 41) % 44);
    out.push(`<rect x="${x}" y="${290 - h}" width="${w}" height="${h}" fill="#111827"/>`);
    for (let wy = 296 - h; wy < 284; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 7)
      if ((wx * 5 + wy * 3 + i) % 7 < 2) out.push(`<rect x="${wx}" y="${wy}" width="3" height="4" fill="#f59e0b" opacity="0.8"/>`);
    x += w + 1; i++;
  }
  return out.join("");
})();
const backdrop = svg(480, 360,
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#s)"/>${stars}${city}` +
  `<rect y="290" width="480" height="70" fill="#0c1a3a"/>` +
  Array.from({ length: 8 }, (_, i) => `<path d="M${(i * 61) % 440 + 10} ${300 + (i * 7) % 20} h24" stroke="#93c5fd" stroke-width="1.5" opacity="0.3"/>`).join("") +
  `<rect x="0" y="322" width="480" height="38" fill="#1e293b" opacity="0.85"/><rect x="0" y="322" width="480" height="2" fill="#475569"/>`);   // the tray

// Fireworks are drawn pointing right, Scratch's direction 90: then "move" goes the way they point. The game turns them
// to point up (direction 0) when they are placed in the tray.
const rocket = svg(48, 20,
  `<path d="M46 10 L34 17 V3z" fill="#e11d48" stroke="#1f2937" stroke-width="1.5"/>` +
  `<rect x="10" y="4" width="24" height="12" fill="#2563eb" stroke="#1f2937" stroke-width="1.5"/><rect x="18" y="4" width="4" height="12" fill="#f8fafc"/>` +
  `<path d="M14 4 L4 0 L10 6z M14 16 L4 20 L10 14z" fill="#e11d48"/><path d="M10 10 H1" stroke="#a16207" stroke-width="2"/>`);
const shell = svg(40, 34,
  `<circle cx="18" cy="17" r="15" fill="#7c3aed" stroke="#1f2937" stroke-width="1.5"/>` +
  `<path d="M14 5 Q22 17 14 29" fill="none" stroke="#c4b5fd" stroke-width="2"/><circle cx="22" cy="12" r="3" fill="#ede9fe" opacity="0.7"/>` +
  `<path d="M33 17 Q39 20 38 25" fill="none" stroke="#a16207" stroke-width="2"/>`);
const fountain = svg(40, 30,
  `<path d="M28 6 V24 L2 28 V2z" fill="#059669" stroke="#1f2937" stroke-width="1.5"/>` +
  `<path d="M16 4 V26" stroke="#a7f3d0" stroke-width="3"/><rect x="27" y="10" width="7" height="10" fill="#e11d48" stroke="#1f2937" stroke-width="1.5"/>`);
// A spark: a coloured glow around the bright core (the core is what sets other fireworks off).
const spark = (glow: string) => svg(14, 14, `<circle cx="7" cy="7" r="6.5" fill="${glow}" opacity="0.55"/><circle cx="7" cy="7" r="4" fill="${SPARK_CORE}"/>`);
const match = (lit: boolean) => svg(34, 34, lit
  ? `<circle cx="17" cy="17" r="16" fill="${SPARK_CORE}"/><circle cx="17" cy="17" r="5" fill="#fff"/>`
  // On a round badge, so it is easy to grab and drag.
  : `<circle cx="17" cy="17" r="16" fill="#334155" stroke="#94a3b8" stroke-width="2"/>` +
    `<rect x="15" y="12" width="4" height="17" rx="1" fill="#d6a46b"/><ellipse cx="17" cy="10" rx="4" ry="5" fill="#dc2626"/>`);

export function art(P: Project) {
  return {
    backdrop: P.costume("night", backdrop, 240, 180),
    firework: [P.costume("rocket", rocket, 24, 10), P.costume("shell", shell, 18, 17), P.costume("fountain", fountain, 18, 15),
      P.costume("spark-red", spark("#f43f5e"), 7, 7), P.costume("spark-purple", spark("#a855f7"), 7, 7), P.costume("spark-green", spark("#10b981"), 7, 7)],
    match: [P.costume("match", match(false), 17, 17), P.costume("flare", match(true), 17, 17)],
  };
}
