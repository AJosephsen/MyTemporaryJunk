// Artwork for Slime Siege (top-down): a meadow with the castle keep on the left, slimes seen from above, the cannon
// cannons (a round base with a barrel pointing right, Scratch's direction 90, so they can turn), bolts, the toolbar,
// and the Target marker. Original SVG. Colours that "touching color" relies on, each used nowhere else:
// TOWER_BASE (a slime touching it chews the tower), BOLT_CORE and POWER_CORE (a slime touching them is hit).
import type { Project } from "../../lib/sb3.ts";

export const TOWER_BASE = "#8b5cf6", POWER_CORE = "#ff2d55", BOLT_CORE = "#ffe600";
export const RANGE = 170;   // how far a seeker cannon reaches
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// The meadow from above: grass with tufts, a few stones, a worn path to the keep; the toolbar along the bottom.
const tufts = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 83 + 29) % 470 + 5, y = (i * 47 + 13) % 290 + 5;
  return `<path d="M${x} ${y} l2 -5 l2 5 l2 -4 l1 4" stroke="${i % 3 ? "#15803d" : "#166534"}" stroke-width="1.2" fill="none"/>`;
}).join("");
const stones = [[300, 60], [380, 230], [180, 250], [420, 110], [250, 150]].map(([x, y], i) =>
  `<ellipse cx="${x}" cy="${y}" rx="${7 + i % 3 * 2}" ry="${5 + i % 2 * 2}" fill="#a8a29e" stroke="#57534e" stroke-width="1.5"/>`).join("");
const flowers = Array.from({ length: 18 }, (_, i) => `<circle cx="${(i * 71 + 41) % 450 + 15}" cy="${(i * 37 + 21) % 280 + 10}" r="2.2" fill="${["#fde68a", "#fbcfe8", "#fff"][i % 3]}"/>`).join("");
const backdrop = svg(480, 360,
  `<rect width="480" height="304" fill="#4ade80"/>` +
  `<path d="M60 150 Q200 120 300 160 T480 150" stroke="#d6b98c" stroke-width="26" fill="none" opacity="0.55" stroke-linecap="round"/>` +
  tufts + stones + flowers +
  `<rect y="304" width="480" height="56" fill="#78350f"/><rect y="304" width="480" height="4" fill="#451a03"/>`);

// The castle keep from above (the target): a round tower with battlements and a flag.
const keep = svg(96, 96,
  `<circle cx="48" cy="48" r="44" fill="#94a3b8" stroke="#334155" stroke-width="3"/>` +
  Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180; return `<rect x="${48 + 38 * Math.cos(a) - 5}" y="${48 + 38 * Math.sin(a) - 5}" width="10" height="10" rx="2" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/>`; }).join("") +
  `<circle cx="48" cy="48" r="26" fill="#64748b" stroke="#334155" stroke-width="2"/><path d="M48 48 V20" stroke="#1e293b" stroke-width="3"/><path d="M48 20 L68 26 L48 32z" fill="#ef4444"/>`);

// A slime from above: a jelly blob with two eyes looking the way it goes (drawn facing right, direction 90).
const slime = (body: string, dark: string, r = 17) => svg(r * 2 + 6, r * 2 + 6,
  `<ellipse cx="${r + 3}" cy="${r + 3}" rx="${r}" ry="${r * 0.9}" fill="${body}" stroke="${dark}" stroke-width="2.5"/>` +
  `<ellipse cx="${r - 3}" cy="${r - 4}" rx="${r * 0.3}" ry="${r * 0.18}" fill="#fff" opacity="0.5"/>` +
  `<circle cx="${r * 1.55}" cy="${r * 0.7}" r="${r * 0.22}" fill="#fff"/><circle cx="${r * 1.55}" cy="${r * 1.45}" r="${r * 0.22}" fill="#fff"/>` +
  `<circle cx="${r * 1.65}" cy="${r * 0.72}" r="${r * 0.11}" fill="#111827"/><circle cx="${r * 1.65}" cy="${r * 1.43}" r="${r * 0.11}" fill="#111827"/>`);

// Cannons from above: a round base (TOWER_BASE, the same for both kinds) and a barrel pointing right (direction 90).
// fixed: an orange crystal and a short double barrel; seeker: a blue crystal and a long barrel. Cracked when hurt.
const tower = (kind: "fixed" | "seeker", cracked: boolean) => svg(56, 44,
  `<circle cx="22" cy="22" r="19" fill="${TOWER_BASE}" stroke="#2e1065" stroke-width="2.5"/>` +
  (kind === "seeker"
    ? `<rect x="22" y="16" width="32" height="12" rx="4" fill="#475569" stroke="#0f172a" stroke-width="2"/><rect x="48" y="14" width="7" height="16" rx="2" fill="#334155"/>`
    : `<rect x="22" y="10" width="24" height="9" rx="3" fill="#475569" stroke="#0f172a" stroke-width="2"/><rect x="22" y="25" width="24" height="9" rx="3" fill="#475569" stroke="#0f172a" stroke-width="2"/>`) +
  `<circle cx="22" cy="22" r="10" fill="${kind === "seeker" ? "#38bdf8" : "#fb923c"}" stroke="${kind === "seeker" ? "#0c4a6e" : "#7c2d12"}" stroke-width="2"/><circle cx="19" cy="19" r="3" fill="#fff" opacity="0.7"/>` +
  (cracked ? `<path d="M8 12 L14 20 L9 27 M30 34 L26 40" stroke="#1e1b4b" stroke-width="2" fill="none"/>` : ""));
const bolt = (core: string) => svg(16, 16, `<circle cx="8" cy="8" r="7" fill="${core}" opacity="0.4"/><circle cx="8" cy="8" r="4" fill="${core}"/>`);
const tile = (icon: string) => svg(52, 46, `<rect x="2" y="2" width="48" height="42" rx="9" fill="#fef3c7" stroke="#451a03" stroke-width="3"/>${icon}`);
const icons: Record<string, string> = {
  speed: `<path d="M29 8 L16 26 H25 L21 39 L36 19 H27z" fill="#f59e0b" stroke="#78350f" stroke-width="1.5"/>`,
  damage: `<circle cx="26" cy="23" r="10" fill="${POWER_CORE}"/><path d="M26 6 V12 M26 34 V40 M9 23 H15 M37 23 H43" stroke="#be123c" stroke-width="3"/>`,
  pierce: `<path d="M8 23 H40 M32 15 L42 23 L32 31" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="23" r="6" fill="#4ade80"/>`,
  strength: `<path d="M26 7 L39 12 V23 Q39 34 26 40 Q13 34 13 23 V12z" fill="#94a3b8" stroke="#334155" stroke-width="2.5"/>`,
  repair: `<path d="M14 34 L30 18 M28 12 Q38 8 40 18 L34 18 L32 22 L36 26 Q26 30 26 20" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round"/>`,
};
const ring = svg(56, 50, `<rect x="2" y="2" width="52" height="46" rx="11" fill="none" stroke="#fde047" stroke-width="4"/>`);

export function art(P: Project) {
  return {
    backdrop: P.costume("meadow", backdrop, 240, 180),
    keep: [P.costume("keep", keep, 48, 48)],
    slime: [P.costume("green", slime("#22c55e", "#14532d"), 20, 20), P.costume("blue", slime("#60a5fa", "#1e3a8a"), 20, 20),
      P.costume("purple", slime("#c084fc", "#581c87"), 20, 20), P.costume("boss", slime("#f472b6", "#831843", 30), 33, 33)],
    tower: [P.costume("fixed", tower("fixed", false), 22, 22), P.costume("fixed-cracked", tower("fixed", true), 22, 22),
      P.costume("seeker", tower("seeker", false), 22, 22), P.costume("seeker-cracked", tower("seeker", true), 22, 22),
      P.costume("bolt", bolt(BOLT_CORE), 8, 8), P.costume("power", bolt(POWER_CORE), 8, 8)],
    tool: ["speed", "damage", "pierce", "strength", "repair"].map(n => P.costume(n, tile(icons[n]), 26, 23)),
    ring: [P.costume("ring", ring, 28, 25)],
    target: [P.costume("target", svg(10, 10, `<circle cx="5" cy="5" r="4" fill="#ef4444"/>`), 5, 5)],
  };
}
