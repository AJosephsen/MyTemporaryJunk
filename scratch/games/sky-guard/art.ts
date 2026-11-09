// Artwork for Sky Guard: the cannon, the bullet, the meteor and the night sky. All original SVG.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// The cannon barrel, drawn pointing right (direction 90), turning around its back end at (10, 14).
const cannon = svg(56, 28,
  `<rect x="6" y="6" width="46" height="16" rx="7" fill="#4b5563" stroke="#1f2937" stroke-width="2"/>` +
  `<rect x="44" y="4" width="10" height="20" rx="3" fill="#374151" stroke="#1f2937" stroke-width="2"/>` +
  `<rect x="14" y="9" width="24" height="3" rx="1.5" fill="#9ca3af" opacity="0.7"/>` +
  `<circle cx="10" cy="14" r="8" fill="#6b7280" stroke="#1f2937" stroke-width="2"/>`);
const bullet = svg(12, 12, `<circle cx="6" cy="6" r="5" fill="#fde68a" stroke="#f59e0b" stroke-width="1.5"/><circle cx="4.5" cy="4.5" r="1.5" fill="#fff"/>`);
// A meteor: a rock with a flame tail above it (it falls, so the tail points up).
const meteor = svg(40, 52,
  `<path d="M20 2 C14 14 10 18 12 26 L28 26 C30 18 26 14 20 2 z" fill="#f97316" opacity="0.85"/>` +
  `<path d="M20 10 C17 16 15 19 16 25 L24 25 C25 19 23 16 20 10 z" fill="#fde047" opacity="0.9"/>` +
  `<path d="M8 34 Q6 22 18 20 Q30 18 34 28 Q38 40 28 48 Q16 52 8 44 Q4 40 8 34 z" fill="#7c5a43" stroke="#3f2a1c" stroke-width="2"/>` +
  `<circle cx="16" cy="36" r="3.5" fill="#5b3f2e"/><circle cx="26" cy="42" r="2.5" fill="#5b3f2e"/><circle cx="25" cy="30" r="2" fill="#5b3f2e"/>`);
const stars = Array.from({ length: 60 }, (_, i) => {
  const x = (i * 83 + 17) % 480, y = (i * 47 + 11) % 300, r = 0.6 + (i % 3) * 0.5;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.5 + (i % 4) * 0.12}"/>`;
}).join("");
const backdrop = svg(480, 360,
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1026"/><stop offset="1" stop-color="#2b2a6e"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#s)"/>${stars}` +
  `<circle cx="400" cy="60" r="26" fill="#f5f3c6"/><circle cx="392" cy="54" r="22" fill="#1a1c4a"/>` +
  `<path d="M0 330 Q60 300 120 325 T240 320 T360 328 T480 318 V360 H0 z" fill="#16331f"/>` +
  `<rect x="0" y="336" width="480" height="24" fill="#0f2416"/>` +
  // the cannon's base, at the bottom middle: the barrel sprite turns on top of it
  `<path d="M210 338 Q240 300 270 338 z" fill="#374151" stroke="#1f2937" stroke-width="2"/>` +
  `<rect x="200" y="334" width="80" height="10" rx="4" fill="#4b5563" stroke="#1f2937" stroke-width="2"/>`);

export function art(P: Project) {
  return {
    cannon: [P.costume("cannon", cannon, 10, 14)],
    bullet: [P.costume("bullet", bullet, 6, 6)],
    meteor: [P.costume("meteor", meteor, 20, 36)],
    backdrop: P.costume("night", backdrop, 240, 180),
  };
}
