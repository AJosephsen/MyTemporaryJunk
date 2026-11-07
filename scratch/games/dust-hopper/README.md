# Dust Hopper

A single-screen Scratch 3 landing game. Guide a survey drone onto the yellow pads of an asteroid.

Open `dust-hopper.sb3` in the Scratch editor (File > Load from your computer).

## Controls

| Key | Action |
|---|---|
| Up / Down | Raise / lower throttle (0–15) |
| Left / Right | Tilt by 11.25° |
| Space | Boost (extra thrust, burns more fuel) |

## Rules

- Land upright (within one tilt step), with low sideways speed.
- Descent below 10 is a perfect landing: 50 × pad multiplier, plus 50 fuel.
- Descent 10–17 is a hard landing: 15 × pad multiplier.
- Anything faster, or touching the rock, is a crash: −150 fuel.
- The game ends when the fuel runs out.

## Structure

There is no game loop in any sprite. The Stage broadcasts `tick` once per frame, and the game moves
through named phases, each a broadcast:

| Phase | Who responds | Job |
|---|---|---|
| `setup` (broadcast and wait) | Stage, Ground, Pads, Drone | Reset totals, fill the pad lists, show instructions |
| `new round` | Drone | Reset the drone at the top, set `state` to `flying` |
| `tick` | Drone | If flying: `read controls`, `run engine`, `move`, `place on screen`, `update displays`, `check touchdown`, `show flame` |
| `round over` | Drone | Show the result, then `new round` or `game over` |
| `game over` | Drone | Show the final score |

### Particles

The Particle sprite makes engine exhaust (fire and smoke) and the crash explosion. Scratch has no blend modes,
so the glow comes from soft costumes that fade to transparent at the edge, plus graphic effects:
fire shrinks, shifts from yellow to red (colour effect) and fades (ghost effect); smoke grows, drifts upwards
and fades. The hidden original sprite is the emitter; each particle is a clone with its own speed, lifetime,
size and growth (variables for this sprite only), and updates itself on every `tick`. Loops that emit several
particles run inside custom blocks without screen refresh, so they finish within the frame. Clones delete
themselves when they fade out or when a new round starts. Full boost peaks at about 90 clones (Scratch allows 300).

The per-frame work is split into custom blocks (My Blocks). Tick scripts never pause: `judge landing`,
which contains the only loop, runs without screen refresh. A tick script that paused would be restarted
by the next tick.

## Physics

Each frame follows the model of the 1979 arcade lander: the throttle level is looked up in a thrust table,
split into x and y by the sine and cosine of the tilt, added to the velocity together with gravity, and the
velocity is added to the position. The drone wraps around the sides using its own position variables, so the
Scratch border limit never applies.

## Building

`build.ts` generates the whole project, including the artwork, as SVG:

```
node --experimental-strip-types --no-warnings build.ts
```

Requires Node 22 or later. No packages are needed.
