// Artwork for Splat Patrol: three house fronts, the window costumes (who is there), the crosshair and the splat.
// All original SVG.
import type { Project } from "../../lib/sb3.ts";

// Where the windows are on each house (Stage coordinates of their centres). The backdrop draws the house around them;
// the Window clones sit on these spots.
export const HOUSES: { name: string; windows: [number, number][] }[] = [
  { name: "cottage", windows: [[-110, 20], [110, 20], [0, -88]] },
  { name: "shop", windows: [[-165, 40], [-55, 40], [55, 40], [165, 40]] },
  { name: "townhouse", windows: [[-110, 100], [0, 100], [110, 100], [-110, -20], [0, -20], [110, -20]] },
];
export const WIN_W = 64, WIN_H = 76;

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// ---------------------------------------------------------------- window costumes (64 x 76)
const frame = `<rect x="2" y="2" width="60" height="72" rx="4" fill="none" stroke="#7a4b23" stroke-width="5"/>` +
  `<rect x="-2" y="70" width="68" height="7" rx="2" fill="#8b5a2b"/>`;
const room = `<rect x="4" y="4" width="56" height="68" fill="#2c2238"/><rect x="4" y="4" width="56" height="10" fill="#3a2e4a"/>`;
const shut = svg(WIN_W, WIN_H, `<rect x="4" y="4" width="28" height="68" fill="#4f8fbf"/><rect x="32" y="4" width="28" height="68" fill="#4a86b3"/>` +
  [12, 24, 36, 48, 60].map(y => `<path d="M7 ${y} H29 M35 ${y} H57" stroke="#2f5f86" stroke-width="2"/>`).join("") +
  `<circle cx="29" cy="40" r="2" fill="#e8c56b"/><circle cx="35" cy="40" r="2" fill="#e8c56b"/>` + frame);
const open = svg(WIN_W, WIN_H, room + frame);
// A raccoon bandit with a mask, holding a water balloon up, ready to throw.
const raccoonBody = (splat: boolean) =>
  `<path d="M14 72 Q14 50 32 48 Q50 50 50 72 z" fill="#8a8f98"/>` +
  `<path d="M16 26 l-5 -12 l11 7 z M48 26 l5 -12 l-11 7 z" fill="#6b7079"/>` +
  `<ellipse cx="32" cy="34" rx="17" ry="15" fill="#9aa0a8"/>` +
  `<path d="M15 31 Q32 22 49 31 Q49 40 40 38 Q32 34 24 38 Q15 40 15 31 z" fill="#2b2b33"/>` +
  (splat
    ? `<path d="M22 33 l4 4 M26 33 l-4 4 M38 33 l4 4 M42 33 l-4 4" stroke="#fff" stroke-width="2"/>`
    : `<circle cx="24" cy="33" r="3" fill="#fff"/><circle cx="40" cy="33" r="3" fill="#fff"/><circle cx="25" cy="33" r="1.5" fill="#111"/><circle cx="41" cy="33" r="1.5" fill="#111"/>`) +
  `<ellipse cx="32" cy="43" rx="6" ry="4" fill="#e7e2da"/><circle cx="32" cy="41" r="2.2" fill="#111"/>` +
  (splat ? "" : `<path d="M50 54 l4 -14" stroke="#9aa0a8" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="55" cy="34" r="7" fill="#e2453c" stroke="#9c2620" stroke-width="1.5"/><path d="M55 41 l-1 3 l2 0 z" fill="#9c2620"/>`);
// Villagers: a granny with glasses and a cat, and a kid with an ice cream.
const grannyBody = `<path d="M12 72 Q12 50 32 48 Q52 50 52 72 z" fill="#c45d9b"/>` +
  `<circle cx="32" cy="22" r="10" fill="#e5e5e5"/><ellipse cx="32" cy="34" rx="13" ry="14" fill="#f2c9a0"/>` +
  `<circle cx="26" cy="33" r="4" fill="none" stroke="#5b4636" stroke-width="1.5"/><circle cx="38" cy="33" r="4" fill="none" stroke="#5b4636" stroke-width="1.5"/>` +
  `<path d="M30 33 h4" stroke="#5b4636" stroke-width="1.5"/><path d="M27 42 q5 3 10 0" stroke="#a0522d" stroke-width="1.6" fill="none"/>` +
  `<ellipse cx="44" cy="62" rx="9" ry="7" fill="#f0a030"/><path d="M38 56 l2 -5 l3 4 M47 55 l3 -4 l1 5" fill="#f0a030"/>` +
  `<circle cx="42" cy="60" r="1" fill="#111"/><circle cx="47" cy="60" r="1" fill="#111"/>`;
const kidBody = `<path d="M16 72 Q16 52 32 50 Q48 52 48 72 z" fill="#3fa34d"/>` +
  `<ellipse cx="32" cy="36" rx="12" ry="13" fill="#e8b48a"/><path d="M20 30 Q32 16 44 30 Q38 24 32 26 Q26 24 20 30 z" fill="#5b3a1e"/>` +
  `<circle cx="27" cy="36" r="1.8" fill="#111"/><circle cx="37" cy="36" r="1.8" fill="#111"/><path d="M28 43 q4 3 8 0" stroke="#8b3a2b" stroke-width="1.6" fill="none"/>` +
  `<path d="M14 64 l6 -16 l6 16 z" fill="#d9a35f"/><circle cx="20" cy="46" r="6" fill="#ffb3c7"/>`;
// A big blue splash over whoever was hit.
const splash = `<path d="M18 30 q6 -10 14 -4 q8 -8 14 2 q10 0 6 10 q8 8 -2 12 q2 10 -10 8 q-6 8 -14 0 q-10 4 -10 -6 q-8 -6 0 -12 q-6 -8 2 -10 z" fill="#38bdf8" opacity="0.85"/>` +
  `<circle cx="12" cy="20" r="3" fill="#38bdf8"/><circle cx="54" cy="22" r="2.5" fill="#38bdf8"/><circle cx="50" cy="62" r="3" fill="#38bdf8"/>`;
const angry = `<path d="M24 28 l6 3 M40 28 l-6 3" stroke="#3a2a1a" stroke-width="2"/>`;
export const WINDOW_COSTUMES = ["shut", "open", "raccoon", "granny", "kid", "raccoon splat", "granny splat", "kid splat"] as const;
const windowSvgs: Record<(typeof WINDOW_COSTUMES)[number], string> = {
  "shut": shut, "open": open,
  "raccoon": svg(WIN_W, WIN_H, room + raccoonBody(false) + frame),
  "granny": svg(WIN_W, WIN_H, room + grannyBody + frame),
  "kid": svg(WIN_W, WIN_H, room + kidBody + frame),
  "raccoon splat": svg(WIN_W, WIN_H, room + raccoonBody(true) + splash + frame),
  "granny splat": svg(WIN_W, WIN_H, room + grannyBody + angry + splash + frame),
  "kid splat": svg(WIN_W, WIN_H, room + kidBody + angry + splash + frame),
};

// The crosshair: a water-balloon sight. The middle is filled very lightly, so a click anywhere inside counts as
// clicking the crosshair (a click on see-through pixels would go to whatever is underneath).
const crosshair = svg(44, 44, `<circle cx="22" cy="22" r="17" fill="#ffffff" fill-opacity="0.08" stroke="#0ea5e9" stroke-width="3"/>` +
  `<path d="M22 1 V13 M22 31 V43 M1 22 H13 M31 22 H43" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/>` +
  `<circle cx="22" cy="22" r="2.5" fill="#e2453c"/>`);
// You got splatted: green goo over the whole screen.
const goo = svg(480, 360, `<path d="M40 60 q60 -50 120 0 q50 -40 120 -10 q90 -30 140 30 q40 60 0 110 q50 70 -20 120 q-60 40 -140 10 q-70 40 -140 -10 q-90 10 -90 -80 q-40 -70 10 -170 z" fill="#4ade80" opacity="0.8"/>` +
  `<circle cx="40" cy="300" r="20" fill="#4ade80" opacity="0.8"/><circle cx="450" cy="40" r="16" fill="#4ade80" opacity="0.8"/><circle cx="430" cy="330" r="12" fill="#4ade80" opacity="0.8"/>`);

// ---------------------------------------------------------------- house fronts (480 x 360), drawn around the windows
const sky = `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ad7ff"/><stop offset="1" stop-color="#e0f4ff"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#s)"/><rect y="310" width="480" height="50" fill="#7bbf5a"/><rect y="306" width="480" height="6" fill="#5c9e3f"/>`;
const sx = (x: number) => 240 + x, sy = (y: number) => 180 - y;   // Stage coordinates to SVG coordinates
const holes = (h: (typeof HOUSES)[number]) => h.windows.map(([x, y]) =>
  `<rect x="${sx(x) - 36}" y="${sy(y) - 42}" width="72" height="84" rx="6" fill="#00000022"/>`).join("");
const house = (i: number) => {
  const h = HOUSES[i];
  if (i === 0) return svg(480, 360, sky +   // cottage: wide, red roof, a door frame around the low window
    `<rect x="70" y="110" width="340" height="200" fill="#f3e3c3" stroke="#c9a46b" stroke-width="3"/>` +
    `<path d="M50 112 L240 20 L430 112 z" fill="#c2453c" stroke="#8f2d26" stroke-width="3"/>` +
    `<rect x="300" y="40" width="34" height="50" fill="#8a6a55"/>` +
    `<rect x="${sx(0) - 44}" y="${sy(-88) - 52}" width="88" height="112" rx="8" fill="#a8743f"/>` + holes(h) +
    `<path d="M100 310 q10 -18 22 0 M360 310 q10 -18 22 0" fill="#3f9e4d"/>`);
  if (i === 1) return svg(480, 360, sky +   // shop: a long low building with a striped awning and a sign
    `<rect x="20" y="70" width="440" height="240" fill="#f8d9a0" stroke="#c9a46b" stroke-width="3"/>` +
    `<rect x="20" y="52" width="440" height="22" fill="#7a4b23"/>` +
    Array.from({ length: 11 }, (_, k) => `<path d="M${20 + k * 40} 160 h40 v18 q-20 12 -40 0 z" fill="${k % 2 ? "#fff" : "#e2453c"}"/>`).join("") +
    `<rect x="170" y="200" width="140" height="40" rx="8" fill="#3b82f6"/><text x="240" y="227" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="20" fill="#fff">SNACKS</text>` +
    holes(h));
  return svg(480, 360, sky +                 // townhouse: tall, brick, flat roof with a chimney
    `<rect x="60" y="20" width="360" height="290" fill="#c96f4a" stroke="#8f4a2e" stroke-width="3"/>` +
    Array.from({ length: 14 }, (_, r) => `<path d="M60 ${40 + r * 20} H420" stroke="#b25f3d" stroke-width="1.5"/>`).join("") +
    `<rect x="50" y="12" width="380" height="14" fill="#8f4a2e"/><rect x="330" y="-4" width="30" height="20" fill="#6b3a24"/>` +
    holes(h));
};

// ---------------------------------------------------------------- deluxe extras (the bonus level, not in the tutorial)
// Disguised raccoons look like villagers at first sight, but always give themselves away: grey fur and a mask under
// the glasses or cap, and a ringed tail sticking out at the side.
const tail = `<path d="M50 70 q10 -6 8 -20 q-2 -10 6 -14" stroke="#6b7079" stroke-width="7" fill="none" stroke-linecap="round"/>` +
  `<path d="M52 64 l7 -2 M57 55 l7 0 M59 45 l6 -3" stroke="#2b2b33" stroke-width="3"/>`;
const furFace = (cx: number, cy: number) => `<ellipse cx="${cx}" cy="${cy}" rx="12" ry="11" fill="#9aa0a8"/>` +
  `<path d="M${cx - 12} ${cy - 2} Q${cx} ${cy - 9} ${cx + 12} ${cy - 2} Q${cx + 12} ${cy + 5} ${cx + 5} ${cy + 3} Q${cx} ${cy} ${cx - 5} ${cy + 3} Q${cx - 12} ${cy + 5} ${cx - 12} ${cy - 2} z" fill="#2b2b33"/>` +
  `<circle cx="${cx - 5}" cy="${cy - 1}" r="1.6" fill="#fff"/><circle cx="${cx + 5}" cy="${cy - 1}" r="1.6" fill="#fff"/>` +
  `<circle cx="${cx}" cy="${cy + 6}" r="1.8" fill="#111"/>`;
const fakeGranny = `<path d="M12 72 Q12 50 32 48 Q52 50 52 72 z" fill="#c45d9b"/>` + tail +
  `<circle cx="32" cy="22" r="10" fill="#e5e5e5"/>` + furFace(32, 34) +
  `<circle cx="26" cy="33" r="4.5" fill="none" stroke="#5b4636" stroke-width="1.5"/><circle cx="38" cy="33" r="4.5" fill="none" stroke="#5b4636" stroke-width="1.5"/>`;
const fakeKid = `<path d="M16 72 Q16 52 32 50 Q48 52 48 72 z" fill="#3fa34d"/>` + tail + furFace(32, 37) +
  `<path d="M18 30 Q32 14 46 30 z" fill="#e2453c"/><rect x="38" y="27" width="14" height="4" rx="2" fill="#e2453c"/>` +
  `<path d="M14 64 l6 -16 l6 16 z" fill="#d9a35f"/><circle cx="20" cy="46" r="6" fill="#ffb3c7"/>`;
// The golden raccoon: rare, shiny, worth 5.
const golden = (splat: boolean) => raccoonBody(splat).replace(/#8a8f98/g, "#d4a017").replace(/#9aa0a8/g, "#f5c518").replace(/#6b7079/g, "#b8860b") +
  `<path d="M10 14 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z M54 52 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 z" fill="#fff59d"/>`;
// Shutters half way open, for the opening animation.
const half = svg(WIN_W, WIN_H, room + `<path d="M4 4 L16 8 V68 L4 72 z" fill="#4f8fbf"/><path d="M60 4 L48 8 V68 L60 72 z" fill="#4a86b3"/>` + frame);
export const DELUXE_WINDOW = ["half", "raccoon granny", "raccoon kid", "golden", "raccoon granny splat", "raccoon kid splat", "golden splat"] as const;
const deluxeWindowSvgs: Record<(typeof DELUXE_WINDOW)[number], string> = {
  "half": half,
  "raccoon granny": svg(WIN_W, WIN_H, room + fakeGranny + frame),
  "raccoon kid": svg(WIN_W, WIN_H, room + fakeKid + frame),
  "golden": svg(WIN_W, WIN_H, room + golden(false) + frame),
  "raccoon granny splat": svg(WIN_W, WIN_H, room + fakeGranny + splash + frame),
  "raccoon kid splat": svg(WIN_W, WIN_H, room + fakeKid + splash + frame),
  "golden splat": svg(WIN_W, WIN_H, room + golden(true) + splash + frame),
};
const drop = svg(12, 14, `<path d="M6 1 Q11 8 10 10 A4.2 4.2 0 0 1 2 10 Q1 8 6 1 z" fill="#38bdf8" stroke="#0284c7" stroke-width="1"/><circle cx="4.5" cy="9" r="1.2" fill="#e0f2fe"/>`);
const spark = svg(14, 14, `<path d="M7 0 l1.8 5.2 l5.2 1.8 l-5.2 1.8 l-1.8 5.2 l-1.8 -5.2 l-5.2 -1.8 l5.2 -1.8 z" fill="#fde047"/>`);
const label = (text: string, fill: string) => svg(110, 44,
  `<text x="55" y="33" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="30" fill="${fill}" stroke="#1f2937" stroke-width="5" paint-order="stroke">${text}</text>`);
const POPUPS: [string, string, string][] = [["+1", "+1", "#fef08a"], ["+3", "+3", "#fdba74"], ["+5", "+5", "#fde047"],
  ["x2", "COMBO x2", "#a5f3fc"], ["x3", "COMBO x3", "#86efac"], ["x4", "COMBO x4", "#f9a8d4"], ["oops", "OOPS!", "#fca5a5"]];
const banner = (name: string) => svg(300, 70,
  `<rect x="4" y="8" width="292" height="56" rx="14" fill="#0b6fa4" stroke="#083d5c" stroke-width="5"/>` +
  `<text x="150" y="47" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="28" fill="#fff">${name}</text>`);
const bird = (up: boolean) => svg(30, 20, `<path d="M2 ${up ? 4 : 14} Q8 ${up ? 8 : 12} 15 11 Q22 ${up ? 8 : 12} 28 ${up ? 4 : 14}" stroke="#334155" stroke-width="3" fill="none" stroke-linecap="round"/>`);
const heart = (x: number, full: boolean) => `<path transform="translate(${x} 0)" d="M15 26 C4 18 0 12 4 6 C8 0 14 2 15 7 C16 2 22 0 26 6 C30 12 26 18 15 26 z" fill="${full ? "#ef4444" : "#ffffff55"}" stroke="#7f1d1d" stroke-width="2"/>`;
const hearts = (n: number) => svg(96, 28, [0, 32, 64].map((x, i) => heart(x, i < n)).join(""));

export function deluxeArt(P: Project) {
  return {
    window: DELUXE_WINDOW.map(n => P.costume(n, deluxeWindowSvgs[n], WIN_W / 2, WIN_H / 2)),
    drop: [P.costume("drop", drop, 6, 7), P.costume("spark", spark, 7, 7)],
    popup: POPUPS.map(([n, text, fill]) => P.costume(n, label(text, fill), 55, 22)),
    banner: HOUSES.map((h, i) => P.costume(h.name, banner(["The Cottage", "The Snack Shop", "The Town House"][i]), 150, 35)),
    bird: [P.costume("up", bird(true), 15, 10), P.costume("down", bird(false), 15, 10)],
    hearts: [0, 1, 2, 3].map(n => P.costume(`h${n}`, hearts(n), 48, 14)),
  };
}

export function art(P: Project) {
  return {
    window: WINDOW_COSTUMES.map(n => P.costume(n, windowSvgs[n], WIN_W / 2, WIN_H / 2)),
    crosshair: [P.costume("sight", crosshair, 22, 22)],
    goo: [P.costume("goo", goo, 240, 180)],
    backdrops: HOUSES.map((h, i) => P.costume(h.name, house(i), 240, 180)),
  };
}
