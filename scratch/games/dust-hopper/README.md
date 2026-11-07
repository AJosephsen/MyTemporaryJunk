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
