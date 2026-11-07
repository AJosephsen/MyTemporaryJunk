# Glimmer Pop

An original bubble shooter for Scratch 3. Aim the launcher, shoot bubbles into the honeycomb at the top, and
match 3 or more of the same colour to pop them. Bubbles left hanging fall away for bonus points. The ceiling
comes down every few shots; clear the board to reach the next level.

| Control | Action |
|---|---|
| Mouse | Aim at the pointer; click to shoot |
| Touch | Tap where you want to shoot |
| ← → | Aim left and right |
| Space or ↑ | Shoot |

## Rules

- 3 or more connected bubbles of the same colour pop: 10 points each.
- Bubbles no longer connected to the ceiling fall: 20 points each.
- Clearing the board: 500 points and the next level, with more rows and colours.
- The ceiling comes down after `9 − level` shots (at least 4). A bubble below the dashed line ends the game.
- The next bubble always has a colour that is still on the board.

## How it works

- **Hex grid:** 12 rows × 8 columns in the list `grid` (`index = row × 8 + col + 1`; 0 empty, 1–6 colour).
  Odd rows are shifted half a bubble right and use 7 cells. Neighbours: same row ±1; rows above and below use
  columns (c−1, c) on even rows and (c, c+1) on odd rows.
- **Drawing:** one clone of the Board sprite per cell shows that cell's colour. Clones stay sharp at any size,
  unlike pen stamps, which are drawn at the Stage's 480 × 360 resolution.
- **Flight:** the shot moves in 4 small steps per frame, bounces off the side walls, and stops at the ceiling or
  within 27 px of a bubble. It snaps to the nearest empty cell touching the ceiling or a bubble.
- **Popping and dropping:** flood fills over the hex neighbours, inside custom blocks that run without screen
  refresh, so they finish within one frame.
- **Phases:** `setup`, `new level`, `ready`, `tick` (every frame), `landed`, `redraw`, `level clear`, `game over`,
  `restart`, as broadcasts, like Dust Hopper.
- **Effects:** pops (swelling bubble, ring and sparks) and falling bubbles are clones of the Fx sprite. They count
  themselves and skip the extras when many are running, to stay under Scratch's 300-clone limit.
- **Artwork:** `art.ts`, all SVG. Each colour also has a symbol for colour-blind players.

`build.ts` generates `glimmer-pop.sb3`; the tests are in `../../tests/glimmer-pop.test.ts`.
