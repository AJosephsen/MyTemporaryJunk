// Artwork for Beanstalk Bounce: the frog, the leaves and the sky. All original SVG.
import type { Project } from "../../lib/sb3.ts";

// Colours the scripts look for with `touching color`.
export const LEAF_GREEN = "#4caf3a", DRY_BROWN = "#b07a3a", CAP_RED = "#e2453c";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// A leaf platform, 72 x 18: a flat top to land on, a vein, and a little curl at one end.
const leaf = (fill: string, dark: string) => svg(72, 18,
  `<path d="M2 7 Q36 -3 70 7 Q60 17 36 16 Q12 17 2 7 z" fill="${fill}" stroke="${dark}" stroke-width="1.5"/>` +
  `<path d="M6 8 Q36 4 66 8" stroke="${dark}" stroke-width="1.2" fill="none"/>` +
  `<path d="M20 8 l5 5 M36 7 l0 6 M52 8 l-5 5" stroke="${dark}" stroke-width="1" opacity="0.7"/>`);
// A spring mushroom on a leaf: landing on the red cap sends the frog very high.
const mushroom = svg(72, 34,
  `<path d="M2 23 Q36 13 70 23 Q60 33 36 32 Q12 33 2 23 z" fill="${LEAF_GREEN}" stroke="#2e7d22" stroke-width="1.5"/>` +
  `<rect x="31" y="12" width="10" height="11" rx="3" fill="#f3e6c8"/>` +
  `<path d="M22 14 Q36 -2 50 14 z" fill="${CAP_RED}" stroke="#9c2620" stroke-width="1.2"/>` +
  `<circle cx="31" cy="8" r="2" fill="#fff"/><circle cx="41" cy="9" r="1.6" fill="#fff"/>`);
// The frog: sitting, and stretched while jumping up.
const frog = (jump: boolean) => svg(44, 44,
  (jump
    ? `<path d="M10 30 l-6 12 M34 30 l6 12" stroke="#2f8a3a" stroke-width="5" stroke-linecap="round"/>`
    : `<ellipse cx="9" cy="38" rx="8" ry="4" fill="#2f8a3a"/><ellipse cx="35" cy="38" rx="8" ry="4" fill="#2f8a3a"/>`) +
  `<ellipse cx="22" cy="${jump ? 24 : 28}" rx="15" ry="${jump ? 14 : 12}" fill="#5cc45a" stroke="#2f8a3a" stroke-width="2"/>` +
  `<ellipse cx="22" cy="${jump ? 28 : 31}" rx="9" ry="6" fill="#d9f5c8"/>` +
  `<circle cx="14" cy="${jump ? 11 : 16}" r="6" fill="#5cc45a" stroke="#2f8a3a" stroke-width="2"/>` +
  `<circle cx="30" cy="${jump ? 11 : 16}" r="6" fill="#5cc45a" stroke="#2f8a3a" stroke-width="2"/>` +
  `<circle cx="14" cy="${jump ? 11 : 16}" r="3" fill="#fff"/><circle cx="30" cy="${jump ? 11 : 16}" r="3" fill="#fff"/>` +
  `<circle cx="15" cy="${jump ? 11 : 16}" r="1.6" fill="#1b2a1b"/><circle cx="31" cy="${jump ? 11 : 16}" r="1.6" fill="#1b2a1b"/>` +
  `<path d="M16 ${jump ? 22 : 26} Q22 ${jump ? 27 : 30} 28 ${jump ? 22 : 26}" stroke="#2f8a3a" stroke-width="1.8" fill="none"/>`);
// A bee: striped, with see-through wings; facing right (flipped for left).
const bee = (flip: boolean) => svg(40, 32, `<g transform="${flip ? "translate(40 0) scale(-1 1)" : ""}">` +
  `<ellipse cx="15" cy="9" rx="8" ry="6" fill="#ffffff" opacity="0.8" stroke="#9ec9e6"/><ellipse cx="24" cy="8" rx="7" ry="5" fill="#ffffff" opacity="0.8" stroke="#9ec9e6"/>` +
  `<ellipse cx="19" cy="19" rx="13" ry="9" fill="#ffc928" stroke="#3a2a10" stroke-width="1.5"/>` +
  `<path d="M14 11 v16 M21 10.5 v17" stroke="#3a2a10" stroke-width="3.5"/>` +
  `<circle cx="29" cy="17" r="2" fill="#3a2a10"/><path d="M5 19 l-4 1 l4 1 z" fill="#3a2a10"/></g>`);
// The sky with a beanstalk climbing up the middle and a few clouds.
const backdrop = svg(480, 360,
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#e3f6ff"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#s)"/>` +
  [[70, 70, 1], [390, 40, 0.8], [330, 250, 1.1], [110, 300, 0.7]].map(([x, y, k]) =>
    `<g transform="translate(${x} ${y}) scale(${k})" fill="#ffffff" opacity="0.85"><ellipse cx="0" cy="0" rx="34" ry="14"/><ellipse cx="-18" cy="-8" rx="16" ry="12"/><ellipse cx="14" cy="-10" rx="18" ry="14"/></g>`).join("") +
  `<path d="M232 360 C212 300 252 260 236 200 C220 140 258 100 240 40 C232 15 246 0 244 0 L254 0 C258 30 246 60 256 100 C270 150 230 190 248 240 C262 290 226 320 246 360 z" fill="#7cc46b" opacity="0.55"/>`);

export function art(P: Project) {
  return {
    frog: [P.costume("sit", frog(false), 22, 22), P.costume("jump", frog(true), 22, 22)],
    leaf: [P.costume("leaf", leaf(LEAF_GREEN, "#2e7d22"), 36, 9), P.costume("dry", leaf(DRY_BROWN, "#7a5222"), 36, 9),
      P.costume("mushroom", mushroom, 36, 25)],
    bee: [P.costume("right", bee(false), 20, 16), P.costume("left", bee(true), 20, 16)],
    backdrop: P.costume("sky", backdrop, 240, 180),
  };
}
