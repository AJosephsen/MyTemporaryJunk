# Game structure patterns

Learned from building five maths arcade games (Number Blaster, Times Table Tower, Number Bonds Pop, Shape Builder,
Greater Gator). All five share one structure; only the mechanic and the maths content differ.

## 1. One game shell

Every game runs through the same phases: `title → play → level done (bonus) → play … → game over → ready`, driven by
a `phase` value. Inside `play`, a small `state` value drives each round (for example `come / eat / wait`, or
`turn / drop / bounce / done`). Timers are frame counters.

## 2. A single heartbeat

Only one place changes the game: once per frame it updates all state, and then everything is drawn from that
state. Drawing never changes state. This removes ordering bugs and race conditions.

## 3. Entities are fixed pools

Game objects (meteors, floors, bubbles, lily pads) are a fixed set of slots in typed records, for example
`bubble[j] = {on, x, y, n, kind, sel, merge, …}`. Each visual object is bound to one slot and only reads it. Objects
switch slots on and off rather than being created and destroyed. Only short-lived effects (text, particles) are spawned.

## 4. Input becomes intents

Raw input (click, tap, key) is turned into an intent and queued (`pick = left`, `button = 3`, `tap`). The frame
update reads the queue once and clears it. Hit-testing is done by position and region (left side, button area, the
bubble under the pointer), not by which visual object received the event.

## 5. Content is separate from the mechanic

- A **generator** per level returns a question, its answer, and believable wrong answers (neighbouring table
  values, swapped digits, "one off", equivalent fractions).
- One **judge** step compares the player's choice with the answer and calls `right` or `wrong`.
- The mechanic around it can be swapped freely: blasting, stacking, popping, rotating, eating.

## 6. A shared effects layer

The same in every game:

- a score that rolls up towards its new value;
- a combo multiplier (×1, ×2, ×3, ×5) for right answers in a row;
- a QUICK bonus for fast answers, and EXACT or PERFECT bonuses for precision;
- hearts or lives, with a heart back at level up;
- screen shake, a flash, floating words (`+300`, `YUM!`, `OOPS!`), sparks, confetti, pulsing text;
- a level-up banner with a bonus that counts up;
- a new backdrop for each band of levels.

The game requests these as fire-and-forget calls (`write(text, group, mode)`, `emit(kind, x, y, count)`), and a
shared kit carries them out. Most of each game's code is a list of these reactions:
`on right → add score, float "+pts", sparks, shake`.

## 7. Levels are a table of settings

The rules never change between levels. Speed, step size, target number, number range and which tables appear are
all worked out from the level number. A mixed mode near the end reuses the earlier generators.

## 8. Text as a display system

All numbers and words are drawn by one sprite-font system. Text belongs to groups, and writing a group replaces its
previous text. Modes:

- **fixed:** stays where it is placed;
- **follow:** moves with an entity slot;
- **float:** rises, fades and removes itself.

Groups can also pulse or cycle colour.

## What this suggests for a modelling language

A game is typed state + one `tick(state, intents)` + drawing from state + a rule table (judge → effects) + a level
table + a declarative effects channel.
