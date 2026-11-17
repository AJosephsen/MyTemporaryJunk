# Puzzle-machine games: a shared core, and the next idea

Noted while building Chain Spark Deluxe (games/chain-spark-deluxe). Its core loop fits many "build a machine"
puzzle games, not just fireworks.

## The reusable core (from Chain Spark Deluxe)

- **Build → TEST → RESET → GO.** The player places and turns parts, tests as often as they like (nothing counts),
  RESET restores the exact layout, GO is the real run. A failed GO keeps the layout.
- **A level** = fixed parts (the start, locked pieces) + a tray of parts to place (limited counts) + a goal.
- **Placed parts are a record (a pool)** with a home position/rotation saved at the start of a run, so RESET is just
  "copy home back and clear the moving things".
- **One update per frame** moves everything; collisions are geometric checks; sprites only draw.
- **Input:** clicks are latched as events (with their position); dragging reads "mouse down?" each frame; a click
  without movement turns a part; dropping a part on the tray takes it away.
- **Scoring/goal** decided by the run; stars or targets per level.

## Next idea: a grid ball machine

- **A grid** (for example 12 × 8 cells). Every part sits in one cell and turns in **90° steps only**.
- **Ball shooters** fire balls along the grid (one ball, or one every N frames).
- **Ball elements** (parts to place or locked in the level):
  - deflectors / mirrors (turn a ball 90°), splitters (one ball in, two out), funnels, conveyors, teleport pairs,
    one-way gates, bumpers that reverse a ball, delays (hold a ball for N frames).
- **Locked items** per level: parts that are part of the puzzle and cannot be moved or turned (some can be turned
  but not moved).
- **Goals: switches.** A ball reaching a switch turns it on. Levels need one switch, **several switches** (all on at
  the same time, or in any order), or switches in a given order.
- **Dangers:** pits and spikes that destroy balls; moving blockers; a level fails if a ball is lost (or if too many).
- **Timing:** doors and gates that open on a rhythm or when a switch is on; switches that stay on only for a few
  seconds, so several balls must arrive close together; shooters that fire on a beat.
- The Build → TEST → RESET → GO loop carries over unchanged.
