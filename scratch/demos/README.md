# Demos

Small experiments: one idea each, kept short and readable. Each folder has a `build.ts` that generates the
`.sb3` (picked up by `npm run build`) and a README explaining the idea and what was learned.

| Demo | Idea |
|---|---|
| [bubble-chain](bubble-chain/) | A bubble shooter without a grid list: matches and loose bubbles are found by bubbles touching each other's glowing rings (`touching color`) |
| [bubble-probe](bubble-probe/) | The same game, but an invisible Probe sprite walks the chain inside a "run without screen refresh" custom block, so the search takes one frame |
| [frame-lab](frame-lab/) | Measures what runs in the same frame: broadcasts, broadcast and wait, warp blocks |
