// Artwork for Starfire Rush: nebula backdrops, two scrolling star layers, the player's ship, seven enemy kinds, the
// boss, bullets, power-up capsules, health/gun/boss bars. Original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const glow = (id: string, c: string) => `<radialGradient id="${id}"><stop offset="0" stop-color="#fff"/><stop offset="0.35" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;

// ---------------------------------------------------------------- space
const nebula = (bg1: string, bg2: string, blobs: [number, number, number, string][]) => svg(480, 360,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>` +
  blobs.map(([, , , c], i) => `<radialGradient id="n${i}"><stop offset="0" stop-color="${c}" stop-opacity="0.55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join("") +
  `</defs><rect width="480" height="360" fill="url(#g)"/>` + blobs.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#n${i})"/>`).join(""));
export const SECTORS = ["violet", "teal", "crimson", "gold"];
const backdrops: [string, string][] = [
  ["violet", nebula("#05010f", "#140a2e", [[120, 90, 160, "#7c3aed"], [380, 260, 190, "#db2777"]])],
  ["teal", nebula("#010b10", "#03222b", [[360, 80, 170, "#0d9488"], [90, 280, 180, "#2563eb"]])],
  ["crimson", nebula("#100204", "#2a050d", [[240, 120, 200, "#dc2626"], [60, 300, 140, "#ea580c"]])],
  ["gold", nebula("#0d0802", "#261a03", [[100, 100, 170, "#ca8a04"], [400, 250, 170, "#65a30d"]])],
];
// Star layers, each 480 × 360 so two copies tile vertically.
const stars = (n: number, seed: number, rMin: number, rMax: number, op: number) => svg(480, 360, Array.from({ length: n }, (_, i) => {
  const x = (i * 97 + seed * 31) % 480, y = (i * 61 + seed * 17) % 360, r = rMin + ((i * 7 + seed) % 10) / 10 * (rMax - rMin);
  return `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${i % 7 === 0 ? "#bae6fd" : i % 11 === 0 ? "#fde68a" : "#fff"}" opacity="${op}"/>`;
}).join(""));

// ---------------------------------------------------------------- the player's ship (nose up), 44 × 52; flame frames
const ship = (flame: number) => svg(44, 60,
  `<defs>${glow("f", "#38bdf8")}</defs>` +
  `<ellipse cx="22" cy="${50 + flame * 2}" rx="${6 + flame}" ry="${9 + flame * 3}" fill="url(#f)"/>` +
  `<path d="M22 2 L30 22 L42 38 L42 44 L28 40 L22 46 L16 40 L2 44 L2 38 L14 22z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>` +
  `<path d="M22 6 L27 22 L22 36 L17 22z" fill="#38bdf8"/><ellipse cx="22" cy="20" rx="3" ry="6" fill="#e0f2fe"/>` +
  `<path d="M4 38 L14 30 M40 38 L30 30" stroke="#f43f5e" stroke-width="3"/>`);
const shield = svg(80, 80, `<defs><radialGradient id="s"><stop offset="0.6" stop-color="#38bdf8" stop-opacity="0"/><stop offset="0.9" stop-color="#7dd3fc" stop-opacity="0.55"/><stop offset="1" stop-color="#e0f2fe" stop-opacity="0.9"/></radialGradient></defs>` +
  `<circle cx="40" cy="40" r="38" fill="url(#s)"/>`);

// ---------------------------------------------------------------- enemies (all point down)
export const ENEMIES = [
  // name, radius for hits, hp, score
  { name: "drifter", r: 15, hp: 2, score: 100 },
  { name: "waver", r: 16, hp: 3, score: 150 },
  { name: "diver", r: 14, hp: 3, score: 200 },
  { name: "gunner", r: 19, hp: 6, score: 300 },
  { name: "tank", r: 30, hp: 26, score: 1000 },
  { name: "spinner", r: 21, hp: 10, score: 600 },
  { name: "swarm", r: 10, hp: 1, score: 80 },
];
const enemyArt: Record<string, string> = {
  drifter: svg(36, 30, `<ellipse cx="18" cy="16" rx="17" ry="8" fill="#ef4444" stroke="#450a0a" stroke-width="2"/><ellipse cx="18" cy="12" rx="8" ry="7" fill="#fca5a5" stroke="#450a0a" stroke-width="2"/><circle cx="18" cy="12" r="3" fill="#fef08a"/>` +
    [6, 18, 30].map(x => `<circle cx="${x}" cy="17" r="2" fill="#fef08a"/>`).join("")),
  waver: svg(42, 30, `<path d="M21 28 L40 6 Q30 10 21 4 Q12 10 2 6z" fill="#22c55e" stroke="#052e16" stroke-width="2" stroke-linejoin="round"/><circle cx="21" cy="14" r="4" fill="#bbf7d0"/><circle cx="21" cy="14" r="2" fill="#052e16"/>`),
  diver: svg(30, 36, `<path d="M15 34 L28 6 L15 12 L2 6z" fill="#facc15" stroke="#422006" stroke-width="2" stroke-linejoin="round"/><path d="M15 26 L20 12 L15 15 L10 12z" fill="#f97316"/>`),
  gunner: svg(46, 40, `<rect x="6" y="6" width="34" height="22" rx="8" fill="#a855f7" stroke="#2e1065" stroke-width="2"/><rect x="19" y="24" width="8" height="14" rx="2" fill="#6b21a8" stroke="#2e1065" stroke-width="2"/>` +
    `<circle cx="23" cy="16" r="6" fill="#f0abfc"/><circle cx="23" cy="16" r="3" fill="#2e1065"/><path d="M2 12 L8 16 L2 22z M44 12 L38 16 L44 22z" fill="#c084fc"/>`),
  tank: svg(72, 64, `<rect x="6" y="4" width="60" height="44" rx="10" fill="#64748b" stroke="#0f172a" stroke-width="3"/><rect x="12" y="10" width="48" height="10" rx="4" fill="#94a3b8"/>` +
    `<rect x="2" y="14" width="8" height="30" rx="3" fill="#334155"/><rect x="62" y="14" width="8" height="30" rx="3" fill="#334155"/>` +
    [18, 36, 54].map(x => `<rect x="${x - 4}" y="40" width="8" height="20" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>`).join("") +
    `<circle cx="36" cy="30" r="9" fill="#f97316" stroke="#7c2d12" stroke-width="2"/><circle cx="36" cy="30" r="4" fill="#fef08a"/>`),
  spinner: svg(48, 48, `<path d="${Array.from({ length: 6 }, (_, i) => { const a = i * 60 * Math.PI / 180, b = (i * 60 + 30) * Math.PI / 180;
      return `${i ? "L" : "M"}${24 + 22 * Math.sin(a)} ${24 - 22 * Math.cos(a)} L${24 + 10 * Math.sin(b)} ${24 - 10 * Math.cos(b)}`; }).join(" ")}z" fill="#fb923c" stroke="#431407" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="24" cy="24" r="7" fill="#fde68a" stroke="#431407" stroke-width="2"/>`),
  swarm: svg(22, 22, `<ellipse cx="11" cy="12" rx="6" ry="8" fill="#f472b6" stroke="#500724" stroke-width="2"/><ellipse cx="4" cy="8" rx="4" ry="3" fill="#fbcfe8" opacity="0.8"/><ellipse cx="18" cy="8" rx="4" ry="3" fill="#fbcfe8" opacity="0.8"/><circle cx="11" cy="16" r="2" fill="#fef08a"/>`),
};
const boss = svg(220, 130,
  `<path d="M110 126 L150 96 L214 70 L206 40 L150 30 L130 4 H90 L70 30 L14 40 L6 70 L70 96z" fill="#334155" stroke="#020617" stroke-width="3" stroke-linejoin="round"/>` +
  `<path d="M110 112 L140 88 L190 66 L186 48 L140 42 L124 18 H96 L80 42 L34 48 L30 66 L80 88z" fill="#475569"/>` +
  [40, 180].map(x => `<rect x="${x - 7}" y="60" width="14" height="34" rx="3" fill="#1e293b" stroke="#020617" stroke-width="2"/><circle cx="${x}" cy="62" r="7" fill="#f43f5e"/>`).join("") +
  `<circle cx="110" cy="62" r="20" fill="#be123c" stroke="#020617" stroke-width="3"/><circle cx="110" cy="62" r="11" fill="#fb7185"/><circle cx="110" cy="62" r="5" fill="#fff1f2"/>` +
  `<path d="M80 100 L110 122 L140 100" fill="none" stroke="#f59e0b" stroke-width="4"/>`);

// ---------------------------------------------------------------- bullets, power-ups
const pshot = (c: string) => svg(10, 24, `<defs>${glow("b", c)}</defs><ellipse cx="5" cy="12" rx="5" ry="12" fill="url(#b)"/><rect x="3.5" y="3" width="3" height="18" rx="1.5" fill="#fff"/>`);
const orb = svg(16, 16, `<defs>${glow("o", "#f472b6")}</defs><circle cx="8" cy="8" r="8" fill="url(#o)"/><circle cx="8" cy="8" r="3.5" fill="#fff"/>`);
const needle = svg(10, 22, `<defs>${glow("n", "#f97316")}</defs><ellipse cx="5" cy="11" rx="5" ry="11" fill="url(#n)"/><ellipse cx="5" cy="11" rx="2" ry="7" fill="#fff7ed"/>`);
const capsule = (c: string, icon: string) => svg(30, 30, `<circle cx="15" cy="15" r="13" fill="${c}" stroke="#fff" stroke-width="2.5"/><circle cx="11" cy="10" r="4" fill="#fff" opacity="0.4"/>${icon}`);
const POWERUPS: [string, string][] = [
  ["power", capsule("#f59e0b", `<path d="M17 5 L9 16 H15 L12 25 L21 13 H15z" fill="#fff"/>`)],
  ["repair", capsule("#16a34a", `<path d="M12 7 H18 V12 H23 V18 H18 V23 H12 V18 H7 V12 H12z" fill="#fff"/>`)],
  ["shield", capsule("#0284c7", `<path d="M15 6 L23 9 V15 Q23 22 15 25 Q7 22 7 15 V9z" fill="none" stroke="#fff" stroke-width="2.5"/>`)],
  ["bomb", capsule("#dc2626", `<circle cx="14" cy="17" r="6" fill="#fff"/><path d="M17 11 L21 7" stroke="#fff" stroke-width="2.5"/><circle cx="22" cy="6" r="2" fill="#fde047"/>`)],
];

// ---------------------------------------------------------------- steel obstacles (cannot be shot)
export const STEEL = [
  { name: "block", w: 70, h: 70 }, { name: "plate", w: 120, h: 40 }, { name: "slab", w: 150, h: 54 }, { name: "girder", w: 200, h: 30 },
];
const steel = (w: number, h: number) => svg(w + 4, h + 4,
  `<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbd5e1"/><stop offset="0.5" stop-color="#94a3b8"/><stop offset="1" stop-color="#475569"/></linearGradient>` +
  `<pattern id="h" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#facc15"/><rect x="8" width="8" height="16" fill="#1e293b"/></pattern></defs>` +
  `<rect x="2" y="2" width="${w}" height="${h}" rx="5" fill="url(#m)" stroke="#0f172a" stroke-width="3"/>` +
  `<rect x="7" y="7" width="${w - 10}" height="${Math.min(8, h / 5)}" rx="2" fill="url(#h)" opacity="0.9"/>` +
  `<rect x="7" y="${h - 3 - Math.min(8, h / 5)}" width="${w - 10}" height="${Math.min(8, h / 5)}" rx="2" fill="url(#h)" opacity="0.9"/>` +
  [[10, h / 2 + 2], [w - 6, h / 2 + 2], [w / 2 + 2, h / 2 + 2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#e2e8f0" stroke="#334155" stroke-width="1.5"/>`).join(""));

// ---------------------------------------------------------------- bars
export const MAX_HP = 6, MAX_GUN = 6;
const cells = (n: number, of: number, on: string, w = 16) => svg(of * (w + 3) + 4, 16,
  Array.from({ length: of }, (_, i) => `<rect x="${2 + i * (w + 3)}" y="2" width="${w}" height="12" rx="3" fill="${i < n ? on : "#1e293b"}" stroke="#0f172a" stroke-width="1.5"/>`).join(""));
const bossBar = (n: number) => svg(300, 14, `<rect x="1" y="1" width="298" height="12" rx="6" fill="#1e293b" stroke="#fda4af" stroke-width="1.5"/>` +
  (n > 0 ? `<rect x="3" y="3" width="${(294 * n / 20).toFixed(1)}" height="8" rx="4" fill="#f43f5e"/>` : ""));
// The gun's energy: a thin meter under the gun pips.
const energyBar = (n: number) => svg(72, 8, `<rect x="1" y="1" width="70" height="6" rx="3" fill="#1e293b" stroke="#0f172a" stroke-width="1"/>` +
  (n > 0 ? `<rect x="2" y="2" width="${(68 * n / 20).toFixed(1)}" height="4" rx="2" fill="${n > 5 ? "#38bdf8" : "#f43f5e"}"/>` : ""));
const flash = (c: string) => svg(480, 360, `<rect width="480" height="360" fill="${c}"/>`);
const hud = svg(480, 40, `<rect width="480" height="40" fill="#020617" opacity="0.55"/><rect y="38" width="480" height="2" fill="#38bdf8" opacity="0.7"/>`);

export function art(P: Project) {
  return {
    backdrop: backdrops.map(([n, s]) => P.costume(n, s, 240, 180)),
    stars: [P.costume("far", stars(70, 3, 0.6, 1.3, 0.6), 240, 180), P.costume("near", stars(28, 9, 1.2, 2.2, 0.95), 240, 180)],
    ship: [0, 1, 2].map(f => P.costume(`ship${f}`, ship(f), 22, 26)),
    shield: [P.costume("shield", shield, 40, 40)],
    enemy: ENEMIES.map(e => P.costume(e.name, enemyArt[e.name], e.name === "tank" ? 36 : e.name === "gunner" ? 23 : enemyArt[e.name].match(/width="(\d+)"/)![1] as any / 2,
      e.name === "tank" ? 30 : e.name === "gunner" ? 18 : enemyArt[e.name].match(/height="(\d+)"/)![1] as any / 2)),
    boss: [P.costume("boss", boss, 110, 62)],
    pshot: [P.costume("blue", pshot("#38bdf8"), 5, 12), P.costume("gold", pshot("#facc15"), 5, 12)],
    eshot: [P.costume("orb", orb, 8, 8), P.costume("needle", needle, 5, 11)],
    powerup: POWERUPS.map(([n, s]) => P.costume(n, s, 15, 15)),
    hpBar: Array.from({ length: MAX_HP + 1 }, (_, n) => P.costume(`hp${n}`, cells(n, MAX_HP, n > 2 ? "#22c55e" : n > 1 ? "#f59e0b" : "#ef4444"), 0, 8)),
    gunBar: Array.from({ length: MAX_GUN + 1 }, (_, n) => P.costume(`gun${n}`, cells(n, MAX_GUN, "#facc15", 8), 0, 8)),
    energyBar: Array.from({ length: 21 }, (_, n) => P.costume(`energy${n}`, energyBar(n), 0, 4)),
    steel: STEEL.map(st => P.costume(st.name, steel(st.w, st.h), st.w / 2 + 2, st.h / 2 + 2)),
    bossBar: Array.from({ length: 21 }, (_, n) => P.costume(`boss${n}`, bossBar(n), 150, 7)),
    hud: [P.costume("hud", hud, 240, 20)],
    flash: [P.costume("white", flash("#fff"), 240, 180), P.costume("red", flash("#ef4444"), 240, 180)],
  };
}

// A preview sheet of the artwork: node art.ts > preview.svg
if (import.meta.url === `file://${process.argv[1]}`) {
  const strip = (s: string) => s.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const at = (x: number, y: number, s: string, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">${strip(s)}</g>`;
  let out = at(0, 0, backdrops[0][1]) + at(0, 0, stars(70, 3, 0.6, 1.3, 0.6)) + at(0, 0, stars(28, 9, 1.2, 2.2, 0.95));
  out += at(220, 280, ship(1)) + at(200, 262, shield);
  ENEMIES.forEach((e, i) => { out += at(20 + i * 64, 40, enemyArt[e.name], 1.2); });
  out += at(130, 120, boss, 1);
  out += at(40, 220, pshot("#38bdf8")) + at(60, 220, pshot("#facc15")) + at(90, 222, orb) + at(115, 220, needle);
  POWERUPS.forEach(([, s], i) => { out += at(340 + i * 34, 220, s); });
  out += at(10, 330, cells(4, MAX_HP, "#22c55e")) + at(150, 330, cells(3, MAX_GUN, "#facc15", 8)) + at(250, 330, bossBar(13), 0.7);
  console.log(svg(480, 360, out));
}
