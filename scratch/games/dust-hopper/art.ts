// Dust Hopper artwork and level data, shared by the game and the tutorial checkpoints.
import type { Project } from "../../lib/sb3.ts";

// ---------------------------------------------------------------- level data
// Ground outline in Scratch coordinates (x: -240..240, y: -180..180).
export const PADS = [
  { l: -150, r: -80, y: -130, mult: 2 },
  { l: 36, r: 68, y: -75, mult: 5 },
  { l: 140, r: 185, y: -110, mult: 3 },
];
export const GROUND: [number, number][] = [
  [-240, -60], [-215, -95], [-190, -80], [-165, -120], [-150, -130], [-80, -130], [-60, -100], [-40, -60],
  [-20, -85], [0, -40], [20, -70], [36, -75], [68, -75], [85, -40], [105, -20], [125, -60], [140, -110],
  [185, -110], [205, -80], [225, -50], [240, -70],
];
// Thrust table from the original source (TRSTAB), plus a boost level.
export const THRUST_TABLE = [0, 2, 5, 8, 11, 13, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 40];

// ---------------------------------------------------------------- artwork (SVG)
const sx = (x: number) => x + 240;
const sy = (y: number) => 180 - y;
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const stars = Array.from({ length: 70 }, () =>
  `<circle cx="${(rand() * 480).toFixed(1)}" cy="${(rand() * 300).toFixed(1)}" r="${(rand() * 1.2 + 0.3).toFixed(2)}" fill="#ffffff" opacity="${(rand() * 0.6 + 0.3).toFixed(2)}"/>`).join("");

const backdrop = svg(480, 360,
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090b1f"/><stop offset="1" stop-color="#22184a"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#sky)"/>${stars}` +
  `<circle cx="420" cy="70" r="46" fill="#3d6f8f"/><circle cx="406" cy="58" r="46" fill="#22184a" opacity="0.55"/>` +
  `<ellipse cx="420" cy="70" rx="72" ry="10" fill="none" stroke="#9fc6dc" stroke-width="2" opacity="0.6" transform="rotate(-18 420 70)"/>`);

const groundPts = [...GROUND.map(([x, y]) => `${sx(x)},${sy(y)}`), `480,360`, `0,360`].join(" ");
const craters = [[-200, -150, 14], [-30, -140, 20], [110, -150, 12], [200, -160, 18], [-110, -165, 9]]
  .map(([x, y, r]) => `<ellipse cx="${sx(x)}" cy="${sy(y)}" rx="${r}" ry="${r * 0.45}" fill="#4a3a52"/>`).join("");
const ground = svg(480, 360, `<polygon points="${groundPts}" fill="#6b5468" stroke="#c7a9b8" stroke-width="2" stroke-linejoin="round"/>${craters}`);

const pads = svg(480, 360, PADS.map(p =>
  `<rect x="${sx(p.l)}" y="${sy(p.y + 4)}" width="${p.r - p.l}" height="4" fill="#ffd23f"/>` +
  `<circle cx="${sx(p.l) + 2}" cy="${sy(p.y + 7)}" r="2" fill="#ff4f5e"/><circle cx="${sx(p.r) - 2}" cy="${sy(p.y + 7)}" r="2" fill="#ff4f5e"/>` +
  `<text x="${sx((p.l + p.r) / 2)}" y="${sy(p.y - 16)}" font-family="Sans Serif" font-size="13" font-weight="bold" fill="#ffd23f" text-anchor="middle">x${p.mult}</text>`).join(""));

// Drone: 40 x 50 canvas, centre (20, 20); feet at y = 33.
const droneBody =
  `<g stroke="#c9d1e0" stroke-width="2" stroke-linecap="round"><line x1="13" y1="24" x2="8" y2="33"/><line x1="27" y1="24" x2="32" y2="33"/>` +
  `<line x1="5" y1="33" x2="11" y2="33"/><line x1="29" y1="33" x2="35" y2="33"/><line x1="20" y1="14" x2="20" y2="8"/></g>` +
  `<circle cx="20" cy="7" r="1.8" fill="#ff4f5e"/><rect x="17" y="26" width="6" height="4" fill="#59606e"/>` +
  `<polygon points="12,14 28,14 31,21 25,27 15,27 9,21" fill="#e8833a" stroke="#7a3a12" stroke-width="1.2" stroke-linejoin="round"/>` +
  `<circle cx="20" cy="19.5" r="4" fill="#7fe0ff" stroke="#1f4e63" stroke-width="1"/>`;
const flame = (len: number) =>
  `<polygon points="17,30 23,30 20,${30 + len}" fill="#ffb13b"/><polygon points="18.5,30 21.5,30 20,${30 + len * 0.6}" fill="#fff3b0"/>`;
const drone = svg(40, 50, droneBody);
const droneFlame = svg(40, 50, flame(9) + droneBody);
const droneBoost = svg(40, 50, flame(17) + droneBody);
const spikes = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2, r = i % 2 ? 9 : 19;
  return `${(20 + r * Math.cos(a)).toFixed(1)},${(20 + r * Math.sin(a)).toFixed(1)}`;
}).join(" ");
const boom = svg(40, 50, `<polygon points="${spikes}" fill="#ff7a2f"/><circle cx="20" cy="20" r="7" fill="#ffe066"/>`);

// Particles: soft round blobs that fade to transparent at the edge, so they look like glow and haze
// even though Scratch has no blend modes. Colour and fading over time are done with graphic effects.
const smoke = svg(32, 32,
  `<defs><radialGradient id="g"><stop offset="0" stop-color="#e2dde9" stop-opacity="0.85"/>` +
  `<stop offset="0.6" stop-color="#aaa3b8" stop-opacity="0.45"/><stop offset="1" stop-color="#8a8499" stop-opacity="0"/></radialGradient></defs>` +
  `<circle cx="16" cy="16" r="16" fill="url(#g)"/>`);
const fire = svg(24, 24,
  `<defs><radialGradient id="g"><stop offset="0" stop-color="#fffbe0"/><stop offset="0.35" stop-color="#ffd23f" stop-opacity="0.95"/>` +
  `<stop offset="0.7" stop-color="#ff7a2f" stop-opacity="0.55"/><stop offset="1" stop-color="#ff4f1e" stop-opacity="0"/></radialGradient></defs>` +
  `<circle cx="12" cy="12" r="12" fill="url(#g)"/>`);

// Costume objects for each sprite, registered with the given project.
export function art(P: Project) {
  return {
    backdrop: P.costume("space", backdrop, 240, 180),
    ground: [P.costume("ground", ground, 240, 180)],
    pads: [P.costume("pads", pads, 240, 180)],
    drone: [P.costume("drone", drone, 20, 20), P.costume("drone-flame", droneFlame, 20, 20),
      P.costume("drone-boost", droneBoost, 20, 20), P.costume("boom", boom, 20, 20)],
    // Registered only when a project uses particles.
    particle: () => [P.costume("fire", fire, 12, 12), P.costume("smoke", smoke, 16, 16)],
  };
}
