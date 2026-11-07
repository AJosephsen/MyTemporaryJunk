# Dust Hopper tutorial

An 8-step Scratch tutorial for building the Dust Hopper landing game by hand.

| File | Contents |
|---|---|
| `index.template.html` | Tutorial text. `<!--changed:N-->` marks where the scripts that are new or changed in step N go |
| `index.html` | Generated page, with the scripts drawn as Scratch blocks (scratchblocks) |
| `starter.sb3` | Artwork only, no code |
| `step1.sb3` … `step8.sb3` | Checkpoint: the project at the end of each step |
| `step*.png` | Screenshots of each checkpoint running in the Scratch editor |
| `blocks.json` | The scratchblocks text for every step and sprite |
| `build-steps.ts` | Generates all of the above (except the screenshots) |

## Rebuilding

```
node --experimental-strip-types --no-warnings build-steps.ts
```

The block pictures are generated from the checkpoint files, so the page and the downloads always match.

## Steps

1. Set the scene (the `setup` phase)
2. Gravity and the tick (custom blocks, `new round`, `tick`)
3. Engine
4. Tilting
5. Screen edges
6. Landing
7. Fuel and score
8. Polish

The tutorial builds the same structure as the full game: phases as broadcasts, a `tick` broadcast once
per frame, and the drone's work split into custom blocks. Each step shows only the scripts it adds or
changes, worked out automatically by comparing checkpoints.

The tutorial uses a simple engine (`force = Throttle × 0.004`). The full game in `../../games/dust-hopper/`
uses the 16-step thrust table from the 1979 arcade lander instead.
