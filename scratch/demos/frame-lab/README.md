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

## Request and response

The Sender broadcasts `request`; 5 responders (a sprite and 4 clones) each change a counter `direct` and broadcast
`response`; the Sender's `when I receive response` adds 1 to `responses`.

| Counter | Result |
|---|---|
| `direct` (changed by each responder) | 5 |
| `responses` (one per received response) | **1** |

A script started by a broadcast exists only once per sprite or clone. When the same message arrives again before that
script has finished, Scratch restarts it instead of running a second copy, so several responses in one frame count
as one. Count in the responders instead (`change direct by 1`, or `add (my id) to [answers]`), and read the count after
`broadcast and wait`, when all responders are done.
