# Frame Lab

Measures what happens within one frame in Scratch. The test (`tests/frame-lab.test.ts`) sets the variable `case`,
triggers the Sender, steps one frame at a time and reads the list `log` after each frame. Each case runs twice: with a
sprite turning (the screen must be redrawn every frame, as in a game) and with nothing moving.

## Broadcasts

| Case | Result |
|---|---|
| `broadcast` | The sender carries on first; the receivers (in other sprites, the Stage and the sender's own sprite) run **later in the same frame**. |
| `broadcast` from a "run without screen refresh" block | Same: receivers run in the same frame, after the block finishes. |
| A chain: a receiver broadcasts again | The whole chain runs in the same frame. |
| `broadcast and wait` | Receivers run in the same frame. The sender continues in the **next frame** when the screen needs redrawing, or in the same frame when nothing moved. |

Why: in each frame Scratch runs the scripts in its list of running scripts, one after another. A broadcast adds the
receiving scripts to the end of that list, so they are reached later in the same pass. A script that waits gets
another turn only when Scratch makes another pass, and it makes another pass only when nothing needs redrawing (and
less than 75 % of the frame time has been used).

So the frame that `broadcast and wait` costs in a game is spent by the *sender* waiting, not by the receivers.
