// Artwork for Gift Factory (the tutorial): the factory wall with snowy windows and a garland, the conveyor belt (three
// costumes that move its stripes along), gifts in three colours and gold, and wicker baskets that show how full they
// are (red0 .. red5, and the same for green and blue).
import type { Project } from "../../lib/sb3.ts";

const INK = "#3b2416";
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

export const COLOURS: Record<string, [string, string, string]> = {   // box, shade, ribbon
  red: ["#e23d3d", "#a92424", "#ffe08a"],
  green: ["#2fa84f", "#1d7436", "#fff5d6"],
  blue: ["#3b82f6", "#1e56b8", "#fde68a"],
  gold: ["#f8c537", "#c8901a", "#d62828"],
};

// The wall: red bricks, two windows with a snowy night, a garland with lights; a wooden floor below.
const bricks = Array.from({ length: 14 }, (_, r) => Array.from({ length: 13 }, (_, c) =>
  `<rect x="${c * 40 - (r % 2) * 20}" y="${r * 18}" width="38" height="16" rx="2" fill="${(r * 7 + c * 3) % 5 ? "#9a3b32" : "#8a3129"}"/>`).join("")).join("");
const snow = Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 37) % 110 + 5}" cy="${(i * 23) % 80 + 5}" r="${1 + (i % 3) * 0.6}" fill="#fff" opacity="0.85"/>`).join("");
const window = (x: number) => `<g transform="translate(${x} 30)"><rect x="-6" y="-6" width="132" height="102" rx="8" fill="#5b3a29"/>` +
  `<rect width="120" height="90" rx="4" fill="#1e2a5a"/><circle cx="92" cy="22" r="10" fill="#f8f4d8"/>${snow}` +
  `<path d="M0 78 Q30 66 60 76 T120 72 V90 H0z" fill="#e8eef8"/><path d="M60 0 V90 M0 45 H120" stroke="#5b3a29" stroke-width="5"/></g>`;
const lights = Array.from({ length: 13 }, (_, i) => {
  const x = 18 + i * 36, y = 14 + Math.sin(i * 1.3) * 3 + 6;
  return `<circle cx="${x}" cy="${y + 8}" r="5" fill="${["#ff5a5a", "#ffd23f", "#5ad1ff", "#7bdc65"][i % 4]}" stroke="${INK}" stroke-width="1"/>`;
}).join("");
const backdrop = svg(480, 360,
  `<rect width="480" height="360" fill="#7d2f28"/>${bricks}` + window(60) + window(300) +
  `<path d="M0 12 Q60 34 120 14 T240 14 T360 14 T480 12" fill="none" stroke="#1f6b35" stroke-width="9" stroke-linecap="round"/>${lights}` +
  // The belt's legs, the hatch where the gifts come from, and the floor.
  `<rect x="40" y="152" width="10" height="100" fill="#4b5563"/><rect x="430" y="152" width="10" height="100" fill="#4b5563"/>` +
  `<rect x="0" y="86" width="34" height="58" rx="4" fill="#3f3f46" stroke="${INK}" stroke-width="2"/><rect x="4" y="92" width="26" height="46" fill="#18181b"/>` +
  `<rect y="250" width="480" height="110" fill="#b7814f"/>` +
  Array.from({ length: 6 }, (_, i) => `<rect y="${250 + i * 19}" width="480" height="2" fill="#94653a"/>`).join("") +
  Array.from({ length: 10 }, (_, i) => `<rect x="${(i * 97) % 480}" y="${252 + (i % 6) * 19}" width="2" height="17" fill="#94653a"/>`).join(""));

// The belt: three costumes with the stripes moved a third of the way along each time, so "next costume" makes it run.
const belt = (k: number) => svg(480, 34,
  `<rect x="0" y="4" width="480" height="24" rx="12" fill="#3f3f46" stroke="${INK}" stroke-width="2"/>` +
  `<clipPath id="b${k}"><rect x="2" y="6" width="476" height="20" rx="10"/></clipPath><g clip-path="url(#b${k})">` +
  Array.from({ length: 34 }, (_, i) => `<path d="M${i * 15 + k * 5 - 10} 26 l10 -20" stroke="#71717a" stroke-width="4"/>`).join("") + `</g>` +
  [14, 466].map(x => `<circle cx="${x}" cy="16" r="10" fill="#a1a1aa" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="16" r="3" fill="${INK}"/>`).join(""));

// A gift: a box with a shaded side, a ribbon cross and a bow.
const gift = (c: string) => {
  const [box, shade, ribbon] = COLOURS[c];
  return svg(38, 38,
    `<rect x="3" y="11" width="32" height="25" rx="3" fill="${box}" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="25" y="12" width="9" height="23" fill="${shade}" opacity="0.6"/>` +
    `<rect x="16" y="11" width="6" height="25" fill="${ribbon}"/><rect x="3" y="20" width="32" height="5" fill="${ribbon}"/>` +
    `<path d="M19 11 C12 2 6 6 12 11 M19 11 C26 2 32 6 26 11" fill="none" stroke="${ribbon}" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="19" cy="11" r="3" fill="${ribbon}" stroke="${INK}" stroke-width="1"/>` +
    (c === "gold" ? `<path d="M8 15 l2 -4 l2 4 l4 1 l-4 2 l-2 4 l-2 -4 l-4 -2z" fill="#fff" opacity="0.9"/>` : ""));
};

// A basket: wicker, a band in its colour, and as many gift tops peeking out as it holds (0 to 5).
const basket = (c: string, n: number) => {
  const [box, shade] = COLOURS[c];
  const tops = [[30, 0], [55, -4], [80, 0], [42, -14], [68, -14]].slice(0, n).map(([x, y], i) => {
    const col = COLOURS[c][0];
    return `<g transform="translate(${x - 12} ${y + 14})"><rect width="24" height="20" rx="3" fill="${col}" stroke="${INK}" stroke-width="2"/>` +
      `<rect x="9" width="6" height="20" fill="#fff5d6"/></g>`;
  }).join("");
  const weave = Array.from({ length: 5 }, (_, r) => `<path d="M10 ${44 + r * 9} H100" stroke="#8a5a2b" stroke-width="2"/>`).join("") +
    Array.from({ length: 11 }, (_, i) => `<path d="M${12 + i * 9} 38 V88" stroke="#a8743f" stroke-width="2" opacity="0.7"/>`).join("");
  return svg(110, 96, tops +
    `<path d="M4 34 H106 L96 92 H14z" fill="#c8924f" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>${weave}` +
    `<rect x="2" y="30" width="106" height="10" rx="5" fill="#a8743f" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="12" y="56" width="86" height="14" fill="${box}" stroke="${INK}" stroke-width="2"/><rect x="12" y="66" width="86" height="4" fill="${shade}"/>`);
};

export function art(P: Project) {
  return {
    backdrop: P.costume("factory", backdrop, 240, 180),
    belt: [0, 1, 2].map(k => P.costume(`belt${k + 1}`, belt(k), 240, 17)),
    gift: Object.keys(COLOURS).map(c => P.costume(c, gift(c), 19, 21)),
    basket: ["red", "green", "blue"].flatMap(c => [0, 1, 2, 3, 4, 5].map(n => P.costume(`${c}${n}`, basket(c, n), 55, 52))),
  };
}
