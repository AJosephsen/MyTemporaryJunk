// Artwork for Sheepdog, seen from above: the meadow, the dog, a sheep and the pen. All original SVG.
import type { Project } from "../../lib/sb3.ts";

export const PEN = { x: 160, y: 110, w: 130, h: 110 };   // centre and size of the pen, top right

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// The dog from above, nose pointing right (direction 90).
const dog = svg(44, 30,
  `<ellipse cx="18" cy="15" rx="15" ry="9" fill="#3b3b3b"/><ellipse cx="18" cy="15" rx="9" ry="6" fill="#f5f5f5"/>` +
  `<path d="M3 15 l-6 -4 v8 z" fill="#3b3b3b"/>` +                                           // tail
  `<circle cx="31" cy="15" r="8" fill="#3b3b3b"/><path d="M30 9 q6 -2 9 3 l-4 6 z" fill="#f5f5f5"/>` +  // head and blaze
  `<circle cx="41" cy="15" r="2.5" fill="#111"/>` +                                           // nose
  `<ellipse cx="26" cy="7" rx="4" ry="3" fill="#3b3b3b"/><ellipse cx="26" cy="23" rx="4" ry="3" fill="#3b3b3b"/>`);  // ears
// A sheep from above, head pointing right.
const sheep = svg(36, 26,
  `<ellipse cx="15" cy="13" rx="13" ry="10" fill="#fdfdfb" stroke="#d9d4c7" stroke-width="1.5"/>` +
  `<circle cx="7" cy="8" r="4" fill="#fff"/><circle cx="14" cy="5" r="4.5" fill="#fff"/><circle cx="21" cy="7" r="4" fill="#fff"/>` +
  `<circle cx="7" cy="18" r="4" fill="#fff"/><circle cx="14" cy="21" r="4.5" fill="#fff"/><circle cx="21" cy="19" r="4" fill="#fff"/>` +
  `<ellipse cx="29" cy="13" rx="6" ry="5" fill="#2b2b2b"/><ellipse cx="26" cy="7" rx="3" ry="2" fill="#2b2b2b"/><ellipse cx="26" cy="19" rx="3" ry="2" fill="#2b2b2b"/>` +
  `<circle cx="32" cy="11" r="1" fill="#fff"/><circle cx="32" cy="15" r="1" fill="#fff"/>`);
// The pen: a fenced area with an open side towards the field (the left). The sprite is the inside, for touching.
const pen = svg(PEN.w, PEN.h,
  `<rect x="2" y="2" width="${PEN.w - 4}" height="${PEN.h - 4}" rx="6" fill="#b7dba0" opacity="0.6"/>` +
  `<g stroke="#8b5a2b" stroke-width="5" stroke-linecap="round" fill="none">` +
  `<path d="M6 6 H${PEN.w - 6} V${PEN.h - 6} H6"/><path d="M6 6 V${PEN.h * 0.3} M6 ${PEN.h * 0.7} V${PEN.h - 6}"/>` +
  Array.from({ length: 6 }, (_, i) => `<path d="M${22 + i * 20} 2 V10 M${22 + i * 20} ${PEN.h - 10} V${PEN.h - 2}"/>`).join("") +
  `</g>`);
const tufts = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 97 + 31) % 480, y = (i * 61 + 13) % 360;
  return `<path d="M${x} ${y} l2 -6 l2 6 M${x + 4} ${y} l2 -5 l2 5" stroke="#5a9e3c" stroke-width="1.5" fill="none"/>`;
}).join("");
const backdrop = svg(480, 360, `<rect width="480" height="360" fill="#7cc252"/>${tufts}` +
  `<ellipse cx="120" cy="300" rx="60" ry="22" fill="#8fd163" opacity="0.7"/><ellipse cx="380" cy="320" rx="50" ry="18" fill="#8fd163" opacity="0.7"/>`);

export function art(P: Project) {
  return {
    dog: [P.costume("dog", dog, 22, 15)],
    sheep: [P.costume("sheep", sheep, 18, 13)],
    pen: [P.costume("pen", pen, PEN.w / 2, PEN.h / 2)],
    backdrop: P.costume("meadow", backdrop, 240, 180),
  };
}
