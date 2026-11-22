// Cartoon artwork for the effect sprites: smoke puffs and a cartoon explosion, drawn like pencil sketches. Every
// outline is a hand-drawn-looking line: the shape's points are nudged a little at random (the same every build), and
// the line is drawn twice, a little differently, like a pencil going over it again. Shading is a darker rim and a few
// hatch strokes. Each puff has two drawings ("a" and "b") that differ only in the wobble: switching between them every
// few frames makes the lines "boil", as in hand-drawn cartoons.
import type { Project } from "../lib/sb3.ts";
import { rng } from "../lib/sound.ts";

const PENCIL = "#2a2833";
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const f = (x: number) => x.toFixed(1);
type Pt = [number, number];

// A cloud outline: n bumps around (cx, cy). Each bump is a curve between two points on a circle, pulled outwards.
function cloud(cx: number, cy: number, R: number, n: number, r: () => number, wobble = 0.08): string {
  const pts: Pt[] = [], ctl: Pt[] = [];
  const start = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2, rr = R * (1 + (r() - 0.5) * wobble * 2);
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.82]);
    const m = a + Math.PI / n, bulge = R * (1.32 + r() * 0.16);
    ctl.push([cx + bulge * Math.cos(m), cy + bulge * Math.sin(m) * 0.82]);
  }
  return `M${f(pts[0][0])} ${f(pts[0][1])}` + pts.map((_, i) => {
    const [qx, qy] = ctl[i], [px, py] = pts[(i + 1) % n];
    return ` Q${f(qx)} ${f(qy)} ${f(px)} ${f(py)}`;
  }).join("") + "Z";
}

// A spiky burst: n spikes with uneven lengths.
function burst(cx: number, cy: number, R: number, n: number, r: () => number, inner = 0.58): string {
  const out: string[] = [];
  const start = r() * Math.PI;
  for (let i = 0; i < n * 2; i++) {
    const a = start + (i / (n * 2)) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const rr = i % 2 ? R * (inner + (r() - 0.5) * 0.1) : R * (0.82 + r() * 0.3);
    out.push(`${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`);
  }
  return `M${out.join(" L")}Z`;
}

// Pencil lines over a shape: twice, the second time thinner and a little shifted.
const pencil = (d: string, width = 2.4) =>
  `<path d="${d}" fill="none" stroke="${PENCIL}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>` +
  `<path d="${d}" fill="none" stroke="${PENCIL}" stroke-width="${width * 0.45}" stroke-linejoin="round" opacity="0.55" transform="translate(0.9 -0.7) rotate(0.8 60 60)"/>`;

// A few short hatch strokes in the lower right of a shape (clipped to it).
function hatch(id: string, d: string, x0: number, y0: number, x1: number, y1: number, r: () => number, count = 6): string {
  const lines = Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, len = 7 + r() * 6;
    return `M${f(x)} ${f(y)} l${f(len * 0.7)} ${f(-len * 0.7)}`;
  }).join(" ");
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
    `<path d="${lines}" clip-path="url(#${id})" stroke="${PENCIL}" stroke-width="1.1" stroke-linecap="round" opacity="0.45" fill="none"/>`;
}

// A smoke puff: light fill, a darker rim at the lower right, hatching, a little highlight, pencil outline.
function puff(variant: number, take: "a" | "b", fill = "#f3f1ec", shade = "#c9c3b8"): string {
  const shape = rng(100 + variant * 7);           // the same shape for both takes...
  const wob = rng(500 + variant * 13 + (take === "a" ? 0 : 1));   // ...but a different wobble
  const n = 4 + variant, R = 21;
  // The shape seeds come from `shape`; the small differences between takes from `wob`.
  const r = () => shape() * 0.85 + wob() * 0.15;
  const d = cloud(40, 36, R, n, r);
  const inner = cloud(36, 31, R * 0.78, n, () => shape() * 0.85 + wob() * 0.15);
  const id = `c${variant}${take}`;
  return svg(80, 72,
    `<defs><clipPath id="${id}k"><path d="${d}"/></clipPath></defs>` +
    `<path d="${d}" fill="${shade}"/><path d="${inner}" fill="${fill}" clip-path="url(#${id}k)"/>` +
    hatch(`${id}h`, d, 44, 56, 66, 34, wob) +
    `<path d="M${f(26 + wob() * 2)} ${f(26 + wob() * 2)} q5 -6 12 -6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/>` +
    pencil(d));
}

// The cartoon explosion, frame by frame: a small flash, a big spiky burst, the biggest burst with smoke behind it,
// then the fire goes and the smoke cloud breaks up into puffs.
function boomFrame(k: number): string {
  const r = rng(900 + k * 31), W = 140, c = 70;
  const fire = (R: number) => {
    const outer = burst(c, c, R, 11, r), mid = burst(c, c, R * 0.74, 9, r), core = burst(c, c, R * 0.46, 7, r, 0.7);
    return `<path d="${outer}" fill="#e8402f"/><path d="${mid}" fill="#f8961e"/><path d="${core}" fill="#ffd93b"/>` +
      `<circle cx="${c}" cy="${c}" r="${f(R * 0.18)}" fill="#fff8d6"/>` + pencil(outer, 2.6) + pencil(mid, 1.6);
  };
  const smoke = (R: number, fill: string, shade: string, n = 7) => {
    const d = cloud(c, c + 4, R, n, r, 0.12), inner = cloud(c - 5, c - 2, R * 0.8, n, r, 0.12);
    return `<defs><clipPath id="b${k}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${shade}"/>` +
      `<path d="${inner}" fill="${fill}" clip-path="url(#b${k})"/>` + hatch(`h${k}`, d, c + 6, c + R * 0.9, c + R, c + 6, r, 8) + pencil(d, 2.6);
  };
  const lines = (R: number, n: number) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.3, l = 8 + r() * 8;
    return `M${f(c + R * Math.cos(a))} ${f(c + R * Math.sin(a))} l${f(l * Math.cos(a))} ${f(l * Math.sin(a))}`;
  }).join(" ");
  const speed = (R: number, n: number) => `<path d="${lines(R, n)}" stroke="${PENCIL}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8"/>`;
  const bodies = [
    fire(22) + speed(30, 8),
    fire(46) + speed(56, 10),
    smoke(44, "#8a817c", "#5f5752") + fire(50),
    smoke(50, "#9b928c", "#6c635e") + `<path d="${burst(c, c - 4, 18, 7, r)}" fill="#f8961e"/>` + pencil(burst(c, c - 4, 18, 7, r), 1.4),
    smoke(54, "#b9b2ab", "#8a827b", 8),
  ];
  return svg(W, W, bodies[k - 1]);
}

export const PUFFS = 3;
export function cartoonArt(P: Project) {
  return {
    puffs: [1, 2, 3].flatMap(v => (["a", "b"] as const).map(t => P.costume(`puff${v}-${t === "a" ? 0 : 1}`, puff(v, t), 40, 36))),
    darkPuffs: [1, 2, 3].flatMap(v => (["a", "b"] as const).map(t => P.costume(`puff${v}-${t === "a" ? 0 : 1}`, puff(v, t, "#9b928c", "#6c635e"), 40, 36))),
    boom: [1, 2, 3, 4, 5].map(k => P.costume(`kaboom${k}`, boomFrame(k), 70, 70)),
  };
}
