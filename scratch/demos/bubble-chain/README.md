# Bubble Chain

Can a bubble shooter find matching and loose bubbles the "Scratch way", with sprites touching each other,
instead of a grid list and flood-fill code? Yes.

## How it works

- **Every stuck bubble is a clone** of the Bubble sprite with its own `color`. There is no grid list.
- **Collision:** the shot moves a few pixels at a time until it is `touching Bubble?` or reaches the ceiling.
- **Snapping:** rounding maths turns the shot's x, y into the nearest honeycomb slot; a new clone appears there.
- **The colour chain:** a marked bubble wears a costume with a **ring in a detector colour**: a pure colour
  (magenta, cyan, yellow…) that appears nowhere else in the artwork, one per bubble colour. The ring reaches about
  3.5 px past the bubble's edge, into its neighbours. Each round:
  1. *check match*: every unmarked bubble of the shot's colour asks `touching color (ring of my colour)?`
  2. *apply match*: those that said yes put on their own ring.
  Rounds repeat until one adds nobody. 3 or more marked bubbles pop; otherwise they take their rings off.
- **Loose bubbles:** the same trick with an orange anchor ring. Bubbles touching the Ceiling sprite are anchored
  first; the anchor spreads through touching rings; bubbles that never get anchored fall.

## What we learned

- **`touching color` only sees what is visible.** The first version started the chain by showing a ringed
  Shooter on top of the new bubble; its body covered the neighbours' rings, so the new bubble never joined.
  Now the new bubble simply starts with its ring on.
- **A clone copies the original's own variables when it is made**, not later. A "start marked" flag kept in a
  global variable was already reset by the time the clone's start script ran; as a variable "for this sprite only"
  it works.
- **Two steps per round** (check, then apply) make the chain grow exactly one ring of bubbles per round. In one
  step, a bubble marked early in a round could mark its neighbours in the same round, depending on the order
  Scratch runs the clones.
- The detector colours must not appear anywhere else, including the backdrop and in-between colours at the
  edges of gradients. Pure colours are safe here.

## Tested

`tests/bubble-chain.test.ts`: three of a colour pop and a hanging bubble falls; two do not pop and lose their
rings; a chain through a whole row; and on random boards, 25 shots aimed like a player, with every result
compared against an exact grid flood fill done in TypeScript: no false or missed matches.

## Compared with Glimmer Pop

Glimmer Pop keeps the board in a list and uses flood fills in custom blocks: exact, instant and fast, but
abstract. Bubble Chain is closer to how Scratch thinks (sprites and touching), shows the logic as it happens,
and needs no index maths, but takes a few frames per chain and relies on carefully chosen colours.
