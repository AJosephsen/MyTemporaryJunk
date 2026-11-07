# Bubble Probe

Can the colour chain of [Bubble Chain](../bubble-chain/) be found in **one frame** instead of round by round?
Yes: one invisible Probe sprite walks the chain inside a custom block that runs without screen refresh.

A step-by-step explanation with the real blocks is in [tutorial.html](tutorial.html) (generated from `tutorial.template.html`).

## How it works

- **One sprite per colour** (`Bubble1` … `Bubble6`). Every stuck bubble is a clone of the sprite of its colour,
  so `touching (join "Bubble" color)?` asks "is a bubble of this colour here?". There is still no grid list.
- **The Probe** is a 4×4 dot, ghosted to 100 % so it is never seen (touching still works when ghosted).
- **find matches** (warp custom block): a queue of positions (`qx`, `qy`) starts with the landed bubble. For each
  position the Probe visits the six neighbour slots, at (±26, 0) and (±13, ±22.5), and asks `touching Bubble<c>?`.
  New hits go into the queue; `seen` holds position keys (`round(x),round(2y)`) so each slot is visited once.
- **find anchored:** the same walk for any colour, starting from every bubble in the top row, skipping matched
  bubbles. Bubbles that are not reached fall.
- **resolve:** the results are lists of keys (`popKeys`, `anchoredKeys`). Each clone checks its own `myKey`
  against them and pops, falls or stays.

## Result

- The test bot fires 25 shots at random boards and compares the result with an exact grid flood fill: all match.
- The search takes **1 frame**; the slowest search frame took about **4 ms** of real time (a frame is 33 ms).

## What we learned

- **Loops in different scripts interleave unless they run without screen refresh.** Six fill loops that shared a
  global counter `i` stepped on each other and made no clones. Moving the loop into a warp custom block fixed it.
- **Give the result its own phase.** While the pop animation ran, the phase was still `probe`, which made the
  search look slower than it was. A separate `resolve` phase keeps the two apart.
- **Bubble Chain vs Bubble Probe:** the rings are nice to watch and need no code walking the board; the probe is
  instant, exact and needs no special costumes, but it is a queue-based search written in blocks.
