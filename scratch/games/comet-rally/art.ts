// Comet Rally artwork: a night court, a blue player paddle, a red robot paddle and a glowing ball.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const stars = Array.from({ length: 40 }, () =>
  `<circle cx="${(rand() * 480).toFixed(1)}" cy="${(rand() * 360).toFixed(1)}" r="${(rand() * 1 + 0.4).toFixed(2)}" fill="#ffffff" opacity="${(rand() * 0.4 + 0.15).toFixed(2)}"/>`).join("");
const dashes = Array.from({ length: 12 }, (_, i) => `<rect x="238" y="${i * 30 + 6}" width="4" height="18" rx="2" fill="#bfe9ff" opacity="0.35"/>`).join("");

const court = svg(480, 360,
  `<defs><radialGradient id="sky" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="#173a5c"/><stop offset="1" stop-color="#0b1730"/></radialGradient></defs>` +
  `<rect width="480" height="360" fill="url(#sky)"/>${stars}${dashes}` +
  `<circle cx="240" cy="180" r="46" fill="none" stroke="#bfe9ff" stroke-width="3" opacity="0.25"/>` +
  `<rect x="2" y="2" width="476" height="356" rx="10" fill="none" stroke="#bfe9ff" stroke-width="3" opacity="0.3"/>`);

// Paddles: 16 x 80, centred.
const player = svg(16, 80,
  `<rect x="1" y="1" width="14" height="78" rx="7" fill="#3fa7ff" stroke="#0d4c86" stroke-width="2"/>` +
  `<rect x="4" y="8" width="3" height="40" rx="1.5" fill="#ffffff" opacity="0.6"/>`);
const robot = svg(16, 80,
  `<rect x="1" y="1" width="14" height="78" rx="7" fill="#ff6b5b" stroke="#8a2318" stroke-width="2"/>` +
  `<circle cx="8" cy="30" r="3.2" fill="#fff6a8"/><circle cx="8" cy="44" r="3.2" fill="#fff6a8"/>` +
  `<rect x="5" y="56" width="6" height="2" rx="1" fill="#8a2318"/>`);

// Ball: 28 x 28 with a soft glow; the solid ball is about 16 px across.
const ball = svg(28, 28,
  `<defs><radialGradient id="glow"><stop offset="0.45" stop-color="#ffe066" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>` +
  `<circle cx="14" cy="14" r="14" fill="url(#glow)"/><circle cx="14" cy="14" r="8" fill="#ffe066" stroke="#f08a24" stroke-width="1.5"/>` +
  `<circle cx="11" cy="11" r="2.5" fill="#ffffff" opacity="0.8"/>`);

export function art(P: Project) {
  return {
    backdrop: P.costume("court", court, 240, 180),
    player: [P.costume("player", player, 8, 40)],
    robot: [P.costume("robot", robot, 8, 40)],
    ball: [P.costume("ball", ball, 14, 14)],
  };
}
