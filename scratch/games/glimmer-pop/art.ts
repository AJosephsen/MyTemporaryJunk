// Glimmer Pop artwork: twilight sky, glass playfield, glossy bubbles with symbols, digits, banners and effects.
import type { Project } from "../../lib/sb3.ts";

// Board geometry, in Stage coordinates. Shared with the game script.
export const GEOM = {
  cols: 8, rows: 12, d: 30, rowH: 26,
  left: -120, right: 120, top: 159,   // playfield edges; top = bottom of the ceiling bar at the start of a level
  danger: -112,                        // a bubble whose bottom crosses this line ends the game
  launchX: 0, launchY: -148,
};

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const sx = (x: number) => x + 240, sy = (y: number) => 180 - y;
const FONT = `font-family="Arial Rounded MT Bold, Helvetica Neue, Arial, sans-serif" font-weight="bold"`;

// ---------------------------------------------------------------- bubbles
export const COLORS = [
  { name: "ruby",   base: "#ff4d6d", light: "#ffb3c1", dark: "#a4133c" },
  { name: "amber",  base: "#ffb627", light: "#ffe29a", dark: "#b86b00" },
  { name: "lime",   base: "#5fd35b", light: "#c6f6b3", dark: "#1f7a26" },
  { name: "aqua",   base: "#2ec4f1", light: "#b8f0ff", dark: "#05668d" },
  { name: "violet", base: "#a06cf2", light: "#dcc8ff", dark: "#5a189a" },
  { name: "cobalt", base: "#4f6bff", light: "#c3ccff", dark: "#1d2a8f" },
];
const SYMBOLS = [
  // heart, star, leaf, drop, diamond, ring: centred on (15, 15)
  `<path d="M15 21.5 C9 17 8.6 13.2 10.4 11.4 C12.2 9.6 14.2 10.6 15 12.2 C15.8 10.6 17.8 9.6 19.6 11.4 C21.4 13.2 21 17 15 21.5Z"/>`,
  `<path d="M15 8.6 L16.9 12.9 L21.5 13.3 L18 16.3 L19.1 20.8 L15 18.4 L10.9 20.8 L12 16.3 L8.5 13.3 L13.1 12.9Z"/>`,
  `<path d="M10 20 C10 13 14 9.5 21 9.5 C21 16.5 17 20 10 20Z M10.5 19.5 L17 13"/>`,
  `<path d="M15 8.8 C17.5 12.6 20 15 20 17.6 C20 20.4 17.8 22 15 22 C12.2 22 10 20.4 10 17.6 C10 15 12.5 12.6 15 8.8Z"/>`,
  `<path d="M15 8.6 L21 15 L15 21.4 L9 15Z"/>`,
  `<circle cx="15" cy="15" r="5.2" fill="none" stroke-width="2.6"/>`,
];
const bubble = (i: number) => {
  const c = COLORS[i];
  return svg(30, 30,
    `<defs><radialGradient id="b" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="${c.light}"/>` +
    `<stop offset="0.45" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient></defs>` +
    `<circle cx="15" cy="15" r="14.3" fill="url(#b)"/>` +
    // reflected light along the lower edge
    `<path d="M5.2 19.5 A11 11 0 0 0 24.8 19.5 A12.5 12.5 0 0 1 5.2 19.5Z" fill="${c.light}" opacity="0.45"/>` +
    `<circle cx="15" cy="15" r="14.3" fill="none" stroke="${c.dark}" stroke-width="1.1"/>` +
    `<g fill="#ffffff" stroke="#ffffff" stroke-width="0.8" stroke-linejoin="round" opacity="0.7">${SYMBOLS[i]}</g>` +
    `<ellipse cx="10.4" cy="8.4" rx="5.4" ry="3.1" fill="#ffffff" opacity="0.8" transform="rotate(-28 10.4 8.4)"/>` +
    `<circle cx="7.4" cy="13" r="1.1" fill="#ffffff" opacity="0.6"/>`);
};

// ---------------------------------------------------------------- backdrop
let seed = 5;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const stars = Array.from({ length: 55 }, () => {
  const x = rand() * 480, y = rand() * 230;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rand() * 1 + 0.3).toFixed(2)}" fill="#fff" opacity="${(rand() * 0.5 + 0.2).toFixed(2)}"/>`;
}).join("");
const panel = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#120a2c" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1.5"/>` +
  `<path d="M${x + 12} ${y + 1.5} H${x + w - 12}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5" stroke-linecap="round"/>`;
const label = (x: number, y: number, text: string, size = 11) =>
  `<text x="${x}" y="${y}" ${FONT} font-size="${size}" fill="#ffffff" fill-opacity="0.7" letter-spacing="1.5" text-anchor="middle">${text}</text>`;
const pf = { x: sx(GEOM.left) - 6, y: 6, w: GEOM.right - GEOM.left + 12, h: 340 };
const backdrop = svg(480, 360,
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1240"/>` +
  `<stop offset="0.55" stop-color="#4b2a6b"/><stop offset="1" stop-color="#c7607a"/></linearGradient>` +
  `<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120a2c" stop-opacity="0.55"/>` +
  `<stop offset="1" stop-color="#120a2c" stop-opacity="0.25"/></linearGradient>` +
  `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset="0.5" stop-color="#ffc56b"/><stop offset="1" stop-color="#c77a2c"/></linearGradient>` +
  `<linearGradient id="dome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b3f99"/><stop offset="1" stop-color="#1e1240"/></linearGradient>` +
  `<linearGradient id="logo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffd9e6"/></linearGradient>` +
  `<linearGradient id="logo2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset="1" stop-color="#ff7aa2"/></linearGradient>` +

  `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe9c4" stop-opacity="0.5"/><stop offset="1" stop-color="#ffe9c4" stop-opacity="0"/></radialGradient>` +
  `<linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a2f6e"/><stop offset="1" stop-color="#2a1640"/></linearGradient>` +
  `<linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#341a4f"/><stop offset="1" stop-color="#160b28"/></linearGradient>` +
  `</defs>` +
  `<rect width="480" height="360" fill="url(#sky)"/>${stars}` +
  // a faint band of stars across the sky
  `<path d="M-20 120 C120 60 300 40 500 70 L500 110 C300 80 140 100 -20 160Z" fill="#ffffff" opacity="0.04"/>` +
  // crescent moon with a soft glow
  `<circle cx="438" cy="214" r="38" fill="url(#glow)"/><circle cx="438" cy="214" r="15" fill="#fff1d6"/><circle cx="445" cy="208" r="13" fill="#4f2c6c"/>` +
  // mountains: far range, then near hills
  `<path d="M0 290 L40 250 L70 268 L110 232 L150 262 L190 240 L240 270 L290 236 L330 258 L372 228 L420 262 L452 244 L480 258 L480 360 L0 360Z" fill="url(#hill1)" opacity="0.9"/>` +
  `<path d="M0 318 C60 296 110 312 160 300 C220 286 270 312 330 300 C390 288 430 306 480 296 L480 360 L0 360Z" fill="url(#hill2)"/>` +
  // glass playfield
  `<rect x="${pf.x}" y="${pf.y}" width="${pf.w}" height="${pf.h}" rx="14" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>` +
  `<line x1="${pf.x + 6}" y1="${sy(GEOM.danger)}" x2="${pf.x + pf.w - 6}" y2="${sy(GEOM.danger)}" stroke="#ff8fa3" stroke-width="2" stroke-dasharray="6 6" opacity="0.8"/>` +
  // launcher base
  `<ellipse cx="${sx(GEOM.launchX)}" cy="${sy(GEOM.launchY) + 13}" rx="40" ry="8" fill="#000" opacity="0.35"/>` +
  `<path d="M${sx(GEOM.launchX) - 34} ${sy(GEOM.launchY) + 13} A34 34 0 0 1 ${sx(GEOM.launchX) + 34} ${sy(GEOM.launchY) + 13} Z" fill="url(#dome)" stroke="url(#gold)" stroke-width="3"/>` +
  `<circle cx="${sx(GEOM.launchX)}" cy="${sy(GEOM.launchY)}" r="18" fill="#120a2c" stroke="url(#gold)" stroke-width="2.5"/>` +
  `<path d="M${sx(GEOM.launchX) - 26} ${sy(GEOM.launchY) - 4} A27 27 0 0 1 ${sx(GEOM.launchX) - 8} ${sy(GEOM.launchY) - 20}" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>` +
  // left panel: score and level
  panel(14, 20, 96, 66) + label(62, 40, "SCORE") +
  panel(14, 100, 96, 66) + label(62, 120, "LEVEL") +
  `<g ${FONT} text-anchor="middle" stroke="#1c1240" stroke-width="5" stroke-linejoin="round" paint-order="stroke">` +
  `<text x="62" y="214" font-size="23" fill="url(#logo)">Glimmer</text>` +
  `<text x="62" y="250" font-size="36" fill="url(#logo2)">Pop</text></g>` +
  `<circle cx="20" cy="190" r="5" fill="#ff4d6d" opacity="0.9"/><circle cx="18.6" cy="188.4" r="1.6" fill="#fff" opacity="0.8"/>` +
  `<circle cx="104" cy="230" r="6.5" fill="#2ec4f1" opacity="0.9"/><circle cx="102.4" cy="228.2" r="2" fill="#fff" opacity="0.8"/>` +
  `<circle cx="96" cy="194" r="3.5" fill="#ffb627" opacity="0.9"/>` +
  // right panel: next bubble, ceiling and controls
  panel(370, 20, 96, 86) + label(418, 40, "NEXT") +
  `<circle cx="418" cy="72" r="20" fill="#000" fill-opacity="0.2" stroke="#fff" stroke-opacity="0.25"/>` +
  panel(370, 120, 96, 50) + label(418, 140, "CEILING") +
  label(418, 268, "AIM", 10) + label(418, 284, "mouse or ← →", 10) +
  label(418, 312, "SHOOT", 10) + label(418, 328, "click or Space", 10));

// ---------------------------------------------------------------- other costumes
const digit = (n: number) => svg(20, 28,
  `<text x="10" y="23" ${FONT} font-size="25" fill="#000" fill-opacity="0.3" text-anchor="middle" transform="translate(1 1.5)">${n}</text>` +
  `<text x="10" y="23" ${FONT} font-size="25" fill="#ffffff" text-anchor="middle">${n}</text>`);
// A ceiling-countdown pip: lit and unlit.
const pip = (on: boolean) => svg(12, 12, `<circle cx="6" cy="6" r="4.5" fill="${on ? "#ffd59a" : "#ffffff"}" fill-opacity="${on ? 1 : 0.18}"/>`);
// Aiming guide: dotted line and arrow head, pointing up from the launcher (rotation centre at the bottom).
const guide = svg(16, 170,
  Array.from({ length: 11 }, (_, i) => `<circle cx="8" cy="${150 - i * 13}" r="${2.6 - i * 0.12}" fill="#ffffff" opacity="${0.85 - i * 0.06}"/>`).join("") +
  `<path d="M8 0 L14 10 L8 7 L2 10Z" fill="#ffffff" opacity="0.6"/>`);
// The ceiling: a grooved plate that fills the space above the bar, so it reads as pushing down when it moves.
const PLATE = 240;
const ceiling = svg(252, PLATE + 22,
  `<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3ecff"/><stop offset="0.45" stop-color="#b9a2ea"/><stop offset="1" stop-color="#5d4296"/></linearGradient>` +
  `<linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1238"/><stop offset="1" stop-color="#3b2770"/></linearGradient>` +
  `<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>` +
  `<rect x="2" y="0" width="248" height="${PLATE + 4}" fill="url(#plate)"/>` +
  Array.from({ length: 9 }, (_, i) => `<rect x="${14 + i * 27}" y="0" width="3" height="${PLATE}" fill="#000" opacity="0.18"/><rect x="${17 + i * 27}" y="0" width="1" height="${PLATE}" fill="#fff" opacity="0.06"/>`).join("") +
  `<rect x="4" y="${PLATE + 14}" width="244" height="8" fill="url(#sh)"/>` +
  `<rect x="0.75" y="${PLATE + 0.75}" width="250.5" height="14.5" rx="5" fill="url(#m)" stroke="#2a1d4d" stroke-width="1.5"/>` +
  `<path d="M6 ${PLATE + 3.5} H246" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1.2" stroke-linecap="round"/>` +
  Array.from({ length: 9 }, (_, i) => `<circle cx="${18 + i * 27}" cy="${PLATE + 8.5}" r="2.2" fill="#3b2770"/><circle cx="${17.4 + i * 27}" cy="${PLATE + 7.9}" r="0.8" fill="#fff" opacity="0.6"/>`).join(""));
const ring = svg(40, 40, `<circle cx="20" cy="20" r="17" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.9"/>`);
const spark = svg(12, 12, `<path d="M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6Z" fill="#fff6d8"/>`);
const sparkle = (x: number, y: number, r: number, c: string) =>
  `<path d="M${x} ${y - r} L${x + r * 0.25} ${y - r * 0.25} L${x + r} ${y} L${x + r * 0.25} ${y + r * 0.25} L${x} ${y + r} L${x - r * 0.25} ${y + r * 0.25} L${x - r} ${y} L${x - r * 0.25} ${y - r * 0.25}Z" fill="${c}"/>`;
const banner = (title: string, sub: string, accent: string, accent2: string) => svg(320, 126,
  `<defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2470"/><stop offset="1" stop-color="#170d33"/></linearGradient>` +
  `<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${accent2}"/></linearGradient></defs>` +
  `<rect x="10" y="16" width="300" height="100" rx="24" fill="#000" opacity="0.3"/>` +
  `<rect x="8" y="10" width="304" height="100" rx="24" fill="url(#p)" stroke="${accent}" stroke-width="3"/>` +
  `<path d="M30 14 H290 A20 20 0 0 1 306 30 C220 40 100 40 14 30 A20 20 0 0 1 30 14Z" fill="#ffffff" opacity="0.10"/>` +
  `<text x="160" y="${sub ? 62 : 74}" ${FONT} font-size="40" fill="url(#t)" stroke="#120a2c" stroke-width="5" stroke-linejoin="round" paint-order="stroke" text-anchor="middle">${title}</text>` +
  (sub ? `<text x="160" y="92" ${FONT} font-size="14.5" fill="#ffffff" fill-opacity="0.88" text-anchor="middle">${sub}</text>` : "") +
  sparkle(22, 10, 9, accent) + sparkle(302, 108, 8, accent2) + sparkle(296, 18, 4.5, "#ffffff"));

export function art(P: Project) {
  const bubbles = COLORS.map((c, i) => P.costume(c.name, bubble(i), 15, 15));
  return {
    backdrop: P.costume("twilight", backdrop, 240, 180),
    bubbles,
    // HUD: digits 0-9 are costumes 1-10, then the ceiling pips (11 off, 12 on).
    hud: [...Array.from({ length: 10 }, (_, n) => P.costume(`digit ${n}`, digit(n), 10, 14)),
      P.costume("pip off", pip(false), 6, 6), P.costume("pip on", pip(true), 6, 6)],
    guide: [P.costume("guide", guide, 8, 170)],
    ceiling: [P.costume("ceiling", ceiling, 126, PLATE + 15)],   // centre at the bar's bottom edge
    fx: [...bubbles, P.costume("ring", ring, 20, 20), P.costume("spark", spark, 6, 6)],
    banner: [
      P.costume("ready", banner("Ready?", "Match 3 or more to pop them!", "#fff1c2", "#ffb347"), 160, 63),
      P.costume("clear", banner("Board clear!", "On to the next level", "#d6ffe4", "#4fd68a"), 160, 63),
      P.costume("over", banner("Game over", "Click or press Space to play again", "#ffd6e0", "#ff5c8a"), 160, 63),
    ],
  };
}
