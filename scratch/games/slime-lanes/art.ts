// Artwork for Slime Lanes: four grass lanes with a castle wall on the right, slimes, the crystal tower, bolts, the
// toolbar. All original SVG. Two colours matter for "touching color": TOWER_BASE (only the towers' stone base has it:
// a slime touching it stops to chew) and POWER_CORE (only the red bolts have it: they hit harder).
import type { Project } from "../../lib/sb3.ts";

export const TOWER_BASE = "#8b5cf6", POWER_CORE = "#ff2d55", BOLT_CORE = "#ffe600";
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// The field: the lanes are rows at stage y = 90, 30, -30, -90 (backdrop y 90, 150, 210, 270); squares are 60 wide.
const lanes = [90, 150, 210, 270].map((y, i) =>
  `<rect x="0" y="${y - 30}" width="480" height="60" fill="${i % 2 ? "#4ade80" : "#22c55e"}"/>` +
  Array.from({ length: 8 }, (_, c) => `<rect x="${c * 60}" y="${y - 30}" width="60" height="60" fill="#000" opacity="${(c + i) % 2 ? 0.04 : 0}"/>`).join("")).join("");
const flowers = Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 71 + 17) % 400}" cy="${70 + (i * 43) % 220}" r="2.5" fill="${i % 2 ? "#fde68a" : "#fff"}"/>`).join("");
const backdrop = svg(480, 360,
  `<rect width="480" height="60" fill="#7dd3fc"/><path d="M0 50 Q80 30 160 48 T320 44 T480 46 V60 H0z" fill="#86efac"/>` +
  lanes + flowers +
  // the castle wall on the left
  `<rect x="0" y="56" width="40" height="248" fill="#94a3b8" stroke="#334155" stroke-width="3"/>` +
  Array.from({ length: 6 }, (_, i) => `<rect x="0" y="${60 + i * 40}" width="40" height="3" fill="#64748b"/>`).join("") +
  `<rect x="14" y="44" width="10" height="14" fill="#94a3b8" stroke="#334155" stroke-width="2"/><rect x="36" y="44" width="10" height="14" fill="#94a3b8" stroke="#334155" stroke-width="2"/>` +
  // the toolbar
  `<rect y="304" width="480" height="56" fill="#78350f"/><rect y="304" width="480" height="4" fill="#451a03"/>`);

// A slime: a jelly blob with eyes, facing left (it crawls that way). size: small / big (the boss).
const slime = (body: string, dark: string, w = 40, h = 32) => svg(w, h,
  `<path d="M3 ${h - 2} Q2 ${h * 0.25} ${w / 2} 3 Q${w - 2} ${h * 0.25} ${w - 3} ${h - 2}z" fill="${body}" stroke="${dark}" stroke-width="2.5"/>` +
  `<ellipse cx="${w * 0.65}" cy="${h * 0.35}" rx="${w * 0.08}" ry="${h * 0.08}" fill="#fff" opacity="0.6"/>` +
  `<circle cx="${w * 0.38}" cy="${h * 0.52}" r="${w * 0.08}" fill="#fff"/><circle cx="${w * 0.2}" cy="${h * 0.52}" r="${w * 0.08}" fill="#fff"/>` +
  `<circle cx="${w * 0.35}" cy="${h * 0.54}" r="${w * 0.04}" fill="#111827"/><circle cx="${w * 0.17}" cy="${h * 0.54}" r="${w * 0.04}" fill="#111827"/>`);

// The crystal tower: a stone base (TOWER_BASE) with a crystal that shoots to the right (the slimes come from there).
const tower = (cracked: boolean) => svg(50, 54,
  `<rect x="7" y="32" width="36" height="20" rx="4" fill="${TOWER_BASE}" stroke="#2e1065" stroke-width="2"/>` +
  `<path d="M25 4 L37 20 L25 34 L13 20z" fill="#38bdf8" stroke="#0c4a6e" stroke-width="2"/><path d="M25 4 L30 20 L25 34z" fill="#bae6fd" opacity="0.7"/>` +
  `<rect x="34" y="16" width="14" height="8" rx="3" fill="#0ea5e9" stroke="#0c4a6e" stroke-width="2"/>` +
  (cracked ? `<path d="M12 34 L18 42 L14 48 M34 34 L30 44 L36 50" stroke="#1e1b4b" stroke-width="2" fill="none"/>` : ""));
const bolt = (core: string) => svg(22, 12, `<ellipse cx="11" cy="6" rx="11" ry="5" fill="${core}" opacity="0.4"/><ellipse cx="12" cy="6" rx="6" ry="3" fill="${core}"/>`);
// Toolbar buttons: a rounded tile with an icon (the price is shown when you point at it).
const tile = (icon: string, c = "#fef3c7") => svg(52, 46, `<rect x="2" y="2" width="48" height="42" rx="9" fill="${c}" stroke="#451a03" stroke-width="3"/>${icon}`);
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
    backdrop: P.costume("lanes", backdrop, 240, 180),
    slime: [P.costume("green", slime("#4ade80", "#14532d"), 20, 18), P.costume("blue", slime("#60a5fa", "#1e3a8a"), 20, 18),
      P.costume("purple", slime("#c084fc", "#581c87"), 20, 18), P.costume("boss", slime("#f472b6", "#831843", 64, 52), 32, 30)],
    tower: [P.costume("tower", tower(false), 25, 30), P.costume("cracked", tower(true), 25, 30),
      P.costume("bolt", bolt(BOLT_CORE), 11, 6), P.costume("power", bolt(POWER_CORE), 11, 6)],
    tool: ["speed", "damage", "pierce", "strength", "repair"].map(n => P.costume(n, tile(icons[n]), 26, 23)),
    ring: [P.costume("ring", ring, 28, 25)],
  };
}
