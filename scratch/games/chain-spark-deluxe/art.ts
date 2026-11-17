// Artwork for Chain Spark Deluxe: a harbour at night, six fireworks (drawn pointing right, Scratch's direction 90),
// glowing sparks in six colours, the fuse where a show starts, the tray, the buttons. Original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const glow = (id: string, c: string) => `<radialGradient id="${id}"><stop offset="0" stop-color="#fff"/><stop offset="0.3" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;

export const KINDS = ["rocket", "shell", "fountain", "crossette", "willow", "spinner"] as const;
export type Kind = typeof KINDS[number];

// ---------------------------------------------------------------- the harbour (the tray is the band at the bottom)
const stars = Array.from({ length: 60 }, (_, i) =>
  `<circle cx="${(i * 97 + 13) % 480}" cy="${(i * 53 + 7) % 200}" r="${0.6 + (i % 3) * 0.4}" fill="#fff" opacity="${0.35 + (i % 4) * 0.12}"/>`).join("");
const skyline = (() => {
  const out: string[] = []; let x = 0, i = 0;
  while (x < 480) {
    const w = 18 + ((i * 31) % 30), h = 20 + ((i * 43) % 50) + (i % 7 === 3 ? 40 : 0);
    out.push(`<rect x="${x}" y="${282 - h}" width="${w}" height="${h}" fill="#0b1022"/>`);
    for (let wy = 288 - h; wy < 276; wy += 8) for (let wx = x + 3; wx < x + w - 3; wx += 6)
      if ((wx * 7 + wy * 5 + i) % 9 < 2) out.push(`<rect x="${wx}" y="${wy}" width="2.5" height="3.5" fill="#fbbf24" opacity="0.75"/>`);
    x += w + 1; i++;
  }
  return out.join("");
})();
const harbour = (top: string, bottom: string) => svg(480, 360,
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>` +
  `<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1631"/><stop offset="1" stop-color="#050913"/></linearGradient></defs>` +
  `<rect width="480" height="282" fill="url(#s)"/>${stars}${skyline}<rect y="282" width="480" height="40" fill="url(#w)"/>` +
  Array.from({ length: 10 }, (_, i) => `<path d="M${(i * 53) % 450 + 8} ${290 + (i * 9) % 26} h${14 + (i % 3) * 8}" stroke="#fbbf24" stroke-width="1.2" opacity="0.25"/>`).join("") +
  `<rect y="322" width="480" height="38" fill="#111827"/><rect y="322" width="480" height="2" fill="#475569"/>`);
export const SKIES = ["dusk", "midnight", "aurora"];
const backdrops: [string, string][] = [
  ["dusk", harbour("#0b1033", "#3b1d5e")], ["midnight", harbour("#020617", "#0f172a")], ["aurora", harbour("#02131a", "#0b3b3a")],
];

// ---------------------------------------------------------------- fireworks (pointing right)
const fw: Record<Kind, string> = {
  rocket: svg(46, 22, `<path d="M44 11 L33 18 V4z" fill="#f43f5e" stroke="#111827" stroke-width="1.5"/><rect x="10" y="5" width="23" height="12" rx="2" fill="#3b82f6" stroke="#111827" stroke-width="1.5"/>` +
    `<rect x="18" y="5" width="4" height="12" fill="#f8fafc"/><path d="M14 5 L4 0 L10 7z M14 17 L4 22 L10 15z" fill="#f43f5e"/><path d="M10 11 H1" stroke="#a16207" stroke-width="2"/>`),
  shell: svg(38, 34, `<circle cx="17" cy="17" r="15" fill="#a855f7" stroke="#111827" stroke-width="1.5"/><path d="M12 4 Q22 17 12 30" fill="none" stroke="#e9d5ff" stroke-width="2"/>` +
    `<circle cx="22" cy="11" r="3" fill="#fff" opacity="0.6"/><path d="M32 17 Q37 20 36 25" fill="none" stroke="#a16207" stroke-width="2"/>`),
  fountain: svg(38, 30, `<path d="M28 6 V24 L2 28 V2z" fill="#10b981" stroke="#111827" stroke-width="1.5"/><path d="M15 4 V26" stroke="#a7f3d0" stroke-width="3"/>` +
    `<rect x="27" y="10" width="8" height="10" rx="1" fill="#f43f5e" stroke="#111827" stroke-width="1.5"/>`),
  crossette: svg(40, 26, `<rect x="4" y="5" width="26" height="16" rx="3" fill="#0ea5e9" stroke="#111827" stroke-width="1.5"/>` +
    `<path d="M30 13 L38 13 M34 9 L34 17" stroke="#f8fafc" stroke-width="2.5" stroke-linecap="round"/><path d="M8 9 L26 17 M8 17 L26 9" stroke="#bae6fd" stroke-width="1.5"/>`),
  willow: svg(36, 36, `<circle cx="16" cy="18" r="14" fill="#f59e0b" stroke="#111827" stroke-width="1.5"/>` +
    [0, 1, 2, 3].map(i => `<path d="M${8 + i * 5} 10 Q${4 + i * 5} 20 ${8 + i * 5} 28" fill="none" stroke="#fef3c7" stroke-width="1.5"/>`).join("") +
    `<path d="M30 18 Q35 20 34 26" fill="none" stroke="#a16207" stroke-width="2"/>`),
  spinner: svg(36, 36, `<circle cx="18" cy="18" r="15" fill="none" stroke="#f472b6" stroke-width="4"/>` +
    [0, 90, 180, 270].map(a => `<rect x="16" y="1" width="4" height="10" rx="1" fill="#ec4899" stroke="#111827" stroke-width="1" transform="rotate(${a} 18 18)"/>`).join("") +
    `<circle cx="18" cy="18" r="5" fill="#fdf2f8" stroke="#111827" stroke-width="1.5"/>`),
};
// Sparks: a white-hot centre in a coloured glow.
export const SPARK_COLOURS = ["gold", "red", "blue", "green", "purple", "pink", "white"];
const hex: Record<string, string> = { gold: "#fbbf24", red: "#f43f5e", blue: "#38bdf8", green: "#34d399", purple: "#c084fc", pink: "#f472b6", white: "#e2e8f0" };
const spark = (c: string, r: number) => svg(r * 2, r * 2, `<defs>${glow("g", c)}</defs><circle cx="${r}" cy="${r}" r="${r}" fill="url(#g)"/>`);

// ---------------------------------------------------------------- the fuse, the tray, buttons, the selection ring
const fuse = (lit: boolean) => svg(40, 40, (lit ? `<circle cx="20" cy="12" r="12" fill="#fde047" opacity="0.5"/><circle cx="20" cy="12" r="5" fill="#fff"/>` : "") +
  `<rect x="15" y="16" width="10" height="22" rx="2" fill="#78350f" stroke="#111827" stroke-width="1.5"/><path d="M20 16 Q16 10 20 6" fill="none" stroke="#e5e7eb" stroke-width="2"/>`);
const slot = svg(56, 36, `<rect x="2" y="2" width="52" height="32" rx="8" fill="#1e293b" stroke="#475569" stroke-width="2"/>`);
const button = (fill: string, icon: string) => svg(84, 34, `<rect x="2" y="2" width="80" height="30" rx="10" fill="${fill}" stroke="#0f172a" stroke-width="2.5"/>` +
  `<rect x="6" y="5" width="72" height="8" rx="4" fill="#fff" opacity="0.2"/>${icon}`);
const ring = svg(48, 48, `<circle cx="24" cy="24" r="21" fill="none" stroke="#fde047" stroke-width="2.5" stroke-dasharray="6 4"/>`);
const flash = (c: string) => svg(480, 360, `<rect width="480" height="360" fill="${c}"/>`);

export function art(P: Project) {
  const fwCostume = (k: Kind) => { const m = fw[k].match(/width="(\d+)" height="(\d+)"/)!; return P.costume(k, fw[k], Number(m[1]) / 2, Number(m[2]) / 2); };
  return {
    backdrop: backdrops.map(([n, s]) => P.costume(n, s, 240, 180)),
    firework: KINDS.map(fwCostume),
    spark: [...SPARK_COLOURS.map(c => P.costume(c, spark(hex[c], 6), 6, 6)), ...SPARK_COLOURS.map(c => P.costume(`big-${c}`, spark(hex[c], 10), 10, 10))],
    fuse: [P.costume("fuse", fuse(false), 20, 20), P.costume("lit", fuse(true), 20, 20)],
    slot: [P.costume("slot", slot, 28, 18)],
    button: [P.costume("test", button("#2563eb", ""), 42, 17), P.costume("reset", button("#475569", ""), 42, 17), P.costume("go", button("#d97706", ""), 42, 17)],
    ring: [P.costume("ring", ring, 24, 24)],
    flash: [P.costume("white", flash("#fff"), 240, 180)],
    hex,
  };
}
