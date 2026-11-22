// Tiny sound synthesiser for Scratch sounds: mono 16-bit WAV at 22050 Hz. Sounds are made from a few parts (tones that
// slide in pitch, filtered noise, clicks), each with its own volume envelope, mixed and normalised.
export const RATE = 22050;

/** A deterministic random number generator, so a build always makes the same sound files. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Volume envelope: a quick rise (attack seconds), then an exponential fall (decay seconds per factor e). */
export const env = (attack: number, decay: number) => (t: number) => t < attack ? t / attack : Math.exp(-(t - attack) / decay);

/** A tone whose pitch slides from f0 to f1 Hz over the sound. */
export function tone(seconds: number, f0: number, f1: number, vol: (t: number) => number, shape: "sine" | "square" | "saw" = "sine"): Float32Array {
  const n = Math.round(seconds * RATE), out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, f = f0 * Math.pow(f1 / f0, t / seconds);
    phase += f / RATE;
    const p = phase % 1;
    const w = shape === "sine" ? Math.sin(2 * Math.PI * p) : shape === "square" ? (p < 0.5 ? 1 : -1) : 2 * p - 1;
    out[i] = w * vol(t);
  }
  return out;
}

/** Noise through a simple low-pass filter: cutoff 0..1 (small = dull rumble, 1 = bright hiss). The cutoff can slide. */
export function noise(seconds: number, cutoff0: number, cutoff1: number, vol: (t: number) => number, seed = 1): Float32Array {
  const n = Math.round(seconds * RATE), out = new Float32Array(n), r = rng(seed);
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, c = cutoff0 + (cutoff1 - cutoff0) * (t / seconds);
    a += c * ((r() * 2 - 1) - a); b += c * (a - b);   // two one-pole low-passes
    out[i] = b * vol(t) * (1 / Math.sqrt(Math.max(c, 0.01)));
  }
  return out;
}

/** Short clicks at random times: crackle. */
export function clicks(seconds: number, count: number, bright: number, vol: (t: number) => number, seed = 2): Float32Array {
  const n = Math.round(seconds * RATE), out = new Float32Array(n), r = rng(seed);
  for (let k = 0; k < count; k++) {
    const at = Math.floor(r() * (n - 400)), len = 40 + Math.floor(r() * 200), amp = 0.3 + r() * 0.7;
    let a = 0;
    for (let i = 0; i < len; i++) { a += bright * ((r() * 2 - 1) - a); out[at + i] += a * amp * Math.exp(-i / (len / 4)) * vol(at / RATE); }
  }
  return out;
}

/** Adds parts together, each starting at its own time (seconds), then normalises to a peak of `peak`. */
export function mix(parts: [number, Float32Array][], peak = 0.85): Float32Array {
  const n = Math.max(...parts.map(([at, p]) => Math.round(at * RATE) + p.length));
  const out = new Float32Array(n);
  for (const [at, p] of parts) { const o = Math.round(at * RATE); for (let i = 0; i < p.length; i++) out[o + i] += p[i]; }
  let max = 0; for (const x of out) max = Math.max(max, Math.abs(x));
  if (max > 0) for (let i = 0; i < n; i++) out[i] *= peak / max;
  // A tiny fade at the end so it never clicks.
  const fade = Math.min(200, n); for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

/** Mono 16-bit PCM WAV. */
export function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((x, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
