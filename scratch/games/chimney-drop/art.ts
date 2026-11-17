// Artwork for Chimney Drop: a snowy night village, Santa's sleigh with a reindeer, houses in three colours, a brick
// chimney (and a glowing one), presents in three colours, a snowflake. All original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// The night: deep blue sky, stars, a moon, far hills, and snow on the ground (its top at stage y = -140).
const stars = Array.from({ length: 50 }, (_, i) =>
  `<circle cx="${(i * 89 + 23) % 480}" cy="${(i * 53 + 11) % 200}" r="${0.8 + (i % 3) * 0.5}" fill="#fff" opacity="${0.5 + (i % 4) * 0.12}"/>`).join("");
const backdrop = svg(480, 360,
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1340"/><stop offset="1" stop-color="#2c3e8f"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#sky)"/>${stars}` +
  `<circle cx="400" cy="60" r="28" fill="#fef9c3"/><circle cx="390" cy="52" r="6" fill="#fde68a" opacity="0.6"/>` +
  `<path d="M0 290 Q100 250 200 280 T400 270 T480 280 V360 H0z" fill="#c7d2fe" opacity="0.5"/>` +
  `<rect y="320" width="480" height="40" fill="#f1f5f9"/><path d="M0 320 Q60 312 120 320 T240 318 T360 321 T480 318 V324 H0z" fill="#ffffff"/>`);

// Santa's sleigh, pulled by a reindeer, facing left (the village scrolls from the right).
const sleigh = svg(150, 64,
  // reindeer
  `<path d="M14 26 L4 12 M14 26 L10 8 M20 24 L28 10 M20 24 L32 14" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>` +
  `<ellipse cx="34" cy="34" rx="18" ry="9" fill="#a16207"/><circle cx="16" cy="26" r="7" fill="#a16207"/><circle cx="10" cy="27" r="3" fill="#ef4444"/>` +
  `<path d="M24 40 L22 52 M30 41 L30 53 M40 41 L42 53 M46 39 L50 50" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>` +
  `<path d="M50 32 L74 38" stroke="#fde68a" stroke-width="2"/>` +
  // sleigh with Santa and a sack
  `<path d="M78 22 H138 Q146 22 144 34 L140 44 H84 Q76 44 78 34z" fill="#dc2626" stroke="#7f1d1d" stroke-width="2.5"/>` +
  `<path d="M74 54 H140 Q150 54 148 46" fill="none" stroke="#facc15" stroke-width="3" stroke-linecap="round"/><path d="M90 44 V54 M130 44 V54" stroke="#facc15" stroke-width="3"/>` +
  `<circle cx="122" cy="12" r="10" fill="#7c2d12"/><path d="M114 8 Q122 -6 130 10z" fill="#7c2d12"/>` +       // the sack
  `<circle cx="98" cy="14" r="8" fill="#fde68a"/><path d="M90 12 Q98 -2 108 12z" fill="#dc2626"/><circle cx="108" cy="6" r="3" fill="#fff"/>` +
  `<path d="M91 16 Q98 26 105 16z" fill="#fff"/>`);
// Houses: a box with a snowy roof, a door and lit windows. 110 wide, 90 high; the chimney is a sprite of its own.
const house = (wall: string, roof: string) => svg(112, 92,
  `<rect x="10" y="40" width="92" height="50" fill="${wall}" stroke="#1e293b" stroke-width="2.5"/>` +
  `<path d="M2 42 L56 4 L110 42z" fill="${roof}" stroke="#1e293b" stroke-width="2.5" stroke-linejoin="round"/>` +
  `<path d="M8 38 L56 6 L104 38 L98 40 Q80 30 56 14 Q32 30 14 40z" fill="#fff"/>` +
  `<rect x="48" y="60" width="18" height="30" fill="#7c2d12" stroke="#1e293b" stroke-width="2"/>` +
  `<rect x="20" y="52" width="18" height="16" fill="#fde047" stroke="#1e293b" stroke-width="2"/><rect x="76" y="52" width="18" height="16" fill="#fde047" stroke="#1e293b" stroke-width="2"/>`);
// The chimney is drawn on a canvas the same size as a house, in its place on the roof: so a Chimney clone and a House
// clone at the same x and y line up (and Scratch keeps them on the stage in the same way).
const chimney = (glow: boolean) => svg(112, 92,
  (glow ? `<ellipse cx="83" cy="6" rx="16" ry="7" fill="#fde047" opacity="0.85"/>` : "") +
  `<rect x="72" y="6" width="22" height="26" fill="#b91c1c" stroke="#1e293b" stroke-width="2"/>` +
  [13, 20, 27].map(y => `<path d="M72 ${y} H94" stroke="#7f1d1d" stroke-width="1.5"/>`).join("") +
  `<rect x="70" y="3" width="26" height="7" rx="3" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>`);
const present = (box: string, ribbon: string) => svg(26, 28,
  `<rect x="2" y="8" width="22" height="18" rx="2" fill="${box}" stroke="#1e293b" stroke-width="1.5"/>` +
  `<rect x="11" y="8" width="4" height="18" fill="${ribbon}"/><rect x="2" y="15" width="22" height="4" fill="${ribbon}"/>` +
  `<path d="M13 8 Q6 0 9 7 M13 8 Q20 0 17 7" fill="none" stroke="${ribbon}" stroke-width="2.5"/>`);
const flake = svg(12, 12, `<circle cx="6" cy="6" r="4" fill="#fff" opacity="0.9"/>`);

export function art(P: Project) {
  return {
    backdrop: P.costume("night", backdrop, 240, 180),
    sleigh: [P.costume("sleigh", sleigh, 110, 32)],          // the centre is under the sack, where presents drop from
    house: [P.costume("red", house("#ef4444", "#7f1d1d"), 56, 46), P.costume("blue", house("#3b82f6", "#1e3a8a"), 56, 46),
      P.costume("green", house("#22c55e", "#14532d"), 56, 46)],
    chimney: [P.costume("chimney", chimney(false), 56, 46), P.costume("glow", chimney(true), 56, 46)],
    present: [P.costume("red", present("#ef4444", "#facc15"), 13, 14), P.costume("green", present("#22c55e", "#ef4444"), 13, 14),
      P.costume("blue", present("#3b82f6", "#f8fafc"), 13, 14)],
    flake: [P.costume("flake", flake, 6, 6)],
  };
}
