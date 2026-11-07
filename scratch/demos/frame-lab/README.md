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

The same-frame resume with nothing moving is fragile: with 4 extra clones in the project, `broadcast and wait`
resumed in the next frame even though nothing moved. Do not rely on it; plan for one frame.

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

## The same message again

| Case | Result |
|---|---|
| Several broadcasts reach a script before it has had its turn | It runs **once** (the request/response case above). |
| A broadcast reaches a script that is **still running** (here: in the middle of a 3-pass loop) | The script **restarts from the top**, in the same frame. The first run is abandoned: it never reaches its last pass or its end. |
| A broadcast reaches a script that **already finished** earlier in the same frame | It runs **again**: in the next frame when the screen needs redrawing, in the same frame when nothing moved. |

Measured with spin = 1, the restart case reads:
`1: send 1 | 1: slow start | 1: slow pass 1 | 2: slow pass 2 | 3: send 2 | 3: slow start | 3: slow pass 1 | 4: slow pass 2 | 5: slow pass 3 | 6: slow end`.

So broadcasts are never queued: each `when I receive` script (per sprite or clone) is either started, restarted or
merged with a start that is already waiting. A script that must finish its work should not be the target of a message
that can arrive again while it runs; let it set a flag that it checks instead, or move the work into a custom block that
runs without screen refresh, so it finishes before the next message can arrive.
