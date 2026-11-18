// Artwork for Boom Lab (the tutorial): an evening test range (sky backdrop, a Land sprite that can shake), the
// explosion pieces (a 5-frame flip-book, a fireball, sparks, embers, smoke, a shockwave ring, debris), a full-screen
// flash and the toolbar with one button per effect.
import type { Project } from "../../lib/sb3.ts";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const star = (cx: number, cy: number, n: number, R: number, r: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = Math.PI * i / n - Math.PI / 2, d = i % 2 ? r : R;
    return `${(cx + d * Math.cos(a)).toFixed(1)},${(cy + d * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

// The sky: evening colours, far-away mesas and the sun. The toolbar is the Button sprite, the ground the Land sprite.
const backdrop = svg(480, 360,
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="0.45" stop-color="#7c2d12"/>` +
  `<stop offset="0.75" stop-color="#ea580c"/><stop offset="1" stop-color="#fdba74"/></linearGradient></defs>` +
  `<rect width="480" height="360" fill="url(#s)"/>` +
  Array.from({ length: 25 }, (_, i) => `<circle cx="${(i * 89 + 13) % 480}" cy="${(i * 37 + 7) % 90}" r="${0.6 + (i % 3) * 0.4}" fill="#fff" opacity="${0.3 + (i % 4) * 0.12}"/>`).join("") +
  `<circle cx="370" cy="215" r="26" fill="#fde68a" opacity="0.9"/>` +
  `<path d="M0 260 V222 H40 L52 200 H110 L122 222 H180 L196 236 H260 L270 212 H330 L344 236 H400 L414 206 H450 L462 230 H480 V260z" fill="#4c1d95" opacity="0.75"/>`);

// The ground, wider than the stage so a shake never shows its edges. Its centre (280, 40) sits at stage (0, -95).
const land = svg(560, 140,
  `<path d="M0 26 Q60 6 120 22 T240 18 T380 24 T560 16 V140 H0z" fill="#78350f"/>` +
  `<path d="M0 34 Q90 26 180 34 T380 32 T560 34 V140 H0z" fill="#b45309"/>` +
  `<rect y="70" width="560" height="70" fill="#92400e"/>` +
  [[60, 40], [150, 52], [255, 44], [330, 58], [420, 42], [505, 50]].map(([x, y], i) =>
    `<ellipse cx="${x}" cy="${y}" rx="${7 + i % 3 * 3}" ry="${4 + i % 2 * 2}" fill="#57534e" stroke="#292524" stroke-width="1"/>`).join("") +
  // Two old barrels and a flag: something to blow up near.
  `<rect x="96" y="22" width="16" height="22" rx="3" fill="#b91c1c" stroke="#450a0a" stroke-width="1.5"/><path d="M96 30 h16 M96 37 h16" stroke="#450a0a"/>` +
  `<rect x="452" y="24" width="16" height="22" rx="3" fill="#15803d" stroke="#052e16" stroke-width="1.5"/><path d="M452 32 h16 M452 39 h16" stroke="#052e16"/>` +
  `<path d="M300 40 V6" stroke="#e5e7eb" stroke-width="2"/><path d="M300 6 L318 11 L300 16z" fill="#facc15"/>` +
  Array.from({ length: 14 }, (_, i) => `<path d="M${(i * 41 + 9) % 560} ${60 + (i * 13) % 50} l3 -6 l3 6" stroke="#65a30d" stroke-width="1.5" fill="none"/>`).join(""));

// The flip-book: five frames of a pop, from a white-hot star to a few wisps.
const pop = [
  svg(84, 84, `<polygon points="${star(42, 42, 10, 14, 7)}" fill="#fef9c3"/><circle cx="42" cy="42" r="6" fill="#fff"/>`),
  svg(84, 84, `<polygon points="${star(42, 42, 10, 24, 13)}" fill="#fb923c"/><polygon points="${star(42, 42, 10, 17, 9)}" fill="#fde047"/><circle cx="42" cy="42" r="7" fill="#fff"/>`),
  svg(84, 84, `<polygon points="${star(42, 42, 12, 32, 19)}" fill="#ef4444"/><polygon points="${star(42, 42, 12, 25, 14)}" fill="#f97316"/><circle cx="42" cy="42" r="11" fill="#fde047"/>`),
  svg(84, 84, `<path d="M${star(42, 42, 12, 37, 26).replace(/ /g, " L")}z M42 22 a20 20 0 1 0 0.1 0z" fill="#dc2626" fill-rule="evenodd"/><circle cx="42" cy="42" r="14" fill="#f97316" opacity="0.5"/>`),
  svg(84, 84, Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6; return `<circle cx="${(42 + 36 * Math.cos(a)).toFixed(1)}" cy="${(42 + 36 * Math.sin(a)).toFixed(1)}" r="3" fill="#7f1d1d" opacity="0.8"/>`;
  }).join("")),
];
const fireball = svg(44, 44,
  `<defs><radialGradient id="f"><stop offset="0" stop-color="#fff"/><stop offset="0.3" stop-color="#fde047"/><stop offset="0.65" stop-color="#f97316"/>` +
  `<stop offset="1" stop-color="#dc2626" stop-opacity="0"/></radialGradient></defs><circle cx="22" cy="22" r="22" fill="url(#f)"/>`);
const spark = svg(12, 12, `<circle cx="6" cy="6" r="6" fill="#fb923c" opacity="0.6"/><circle cx="6" cy="6" r="3.5" fill="#fef08a"/>`);
const ember = svg(8, 8, `<circle cx="4" cy="4" r="4" fill="#f97316"/><circle cx="4" cy="4" r="2" fill="#fef9c3"/>`);
const smoke = svg(48, 40,
  `<circle cx="16" cy="24" r="13" fill="#6b7280"/><circle cx="30" cy="22" r="15" fill="#6b7280"/><circle cx="24" cy="13" r="11" fill="#9ca3af"/>` +
  `<circle cx="20" cy="11" r="4" fill="#d1d5db" opacity="0.6"/>`);
const shock = svg(84, 84, `<circle cx="42" cy="42" r="38" fill="none" stroke="#fff7ed" stroke-width="5"/><circle cx="42" cy="42" r="31" fill="none" stroke="#fed7aa" stroke-width="2" opacity="0.6"/>`);
const rock = svg(16, 14, `<path d="M2 8 L5 2 L12 1 L15 7 L11 13 L4 12z" fill="#57534e" stroke="#1c1917" stroke-width="1.2"/><path d="M6 4 L10 4" stroke="#a8a29e"/>`);
const plank = svg(24, 9, `<rect x="1" y="1" width="22" height="7" rx="1" fill="#b45309" stroke="#451a03" stroke-width="1.2"/><circle cx="5" cy="4.5" r="1" fill="#1c1917"/><circle cx="19" cy="4.5" r="1" fill="#1c1917"/>`);
const flash = svg(480, 360, `<rect width="480" height="360" fill="#fffbeb"/>`);

// The toolbar (the Button sprite's own costume) and the buttons: a dark tile with a picture of the effect.
const bar = svg(480, 40, `<rect width="480" height="40" fill="#0f172a"/><rect width="480" height="2" fill="#f97316"/>`);
const tile = (icon: string) => svg(52, 34, `<rect x="1" y="1" width="50" height="32" rx="7" fill="#1e293b" stroke="#64748b" stroke-width="2"/>${icon}`);
const icons: Record<string, string> = {
  pop: `<polygon points="${star(26, 17, 8, 12, 6)}" fill="#fde047" stroke="#f97316" stroke-width="1.5"/>`,
  fireball: `<circle cx="26" cy="17" r="12" fill="#dc2626"/><circle cx="26" cy="17" r="8" fill="#f97316"/><circle cx="26" cy="17" r="4" fill="#fef08a"/>`,
  ring: Array.from({ length: 10 }, (_, i) => `<circle cx="${(26 + 11 * Math.cos(i * Math.PI / 5)).toFixed(1)}" cy="${(17 + 11 * Math.sin(i * Math.PI / 5)).toFixed(1)}" r="2.3" fill="#fde047"/>`).join(""),
  sparks: `<path d="M26 26 Q14 2 8 26 M26 26 Q38 2 44 26 M26 26 Q22 0 18 22 M26 26 Q30 0 34 22" fill="none" stroke="#fb923c" stroke-width="2" stroke-dasharray="2 3"/>`,
  smoke: `<circle cx="19" cy="20" r="7" fill="#9ca3af"/><circle cx="29" cy="18" r="8" fill="#9ca3af"/><circle cx="25" cy="12" r="6" fill="#d1d5db"/>`,
  blast: `<rect x="4" y="4" width="44" height="26" rx="4" fill="#fffbeb" opacity="0.25"/><circle cx="26" cy="17" r="12" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="26" cy="17" r="5" fill="#fde047"/>`,
  quake: `<path d="M6 25 H46" stroke="#b45309" stroke-width="3"/><path d="M14 8 l4 6 l-4 4 l4 6 M26 6 l4 6 l-4 4 l4 8 M38 8 l4 6 l-4 4 l4 6" stroke="#fde68a" stroke-width="2" fill="none"/>`,
  mega: `<polygon points="${star(26, 17, 12, 15, 8)}" fill="#dc2626"/><polygon points="${star(26, 17, 8, 9, 5)}" fill="#fde047"/><circle cx="26" cy="17" r="3" fill="#fff"/>`,
};

export function art(P: Project) {
  return {
    backdrop: P.costume("evening", backdrop, 240, 180),
    land: [P.costume("land", land, 280, 40)],
    boom: [
      ...pop.map((s, i) => P.costume(`pop${i + 1}`, s, 42, 42)),
      P.costume("fireball", fireball, 22, 22), P.costume("spark", spark, 6, 6), P.costume("ember", ember, 4, 4),
      P.costume("smoke", smoke, 24, 20), P.costume("shock", shock, 42, 42), P.costume("chunk1", rock, 8, 7), P.costume("chunk2", plank, 12, 4.5),
    ],
    flash: [P.costume("flash", flash, 240, 180)],
    button: [P.costume("bar", bar, 240, 20), ...Object.entries(icons).map(([n, icon]) => P.costume(n, tile(icon), 26, 17))],
  };
}
