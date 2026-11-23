# Sprites

Reusable Scratch sprites (`.sprite3`), generated from TypeScript like the projects. Add one to any project in the
Scratch editor with **Upload Sprite**. The page `index.html` shows them all, with their sounds and how to use them.

| Folder / file | Contents |
|---|---|
| `effects.ts` | The effect sprites: artwork (from Boom Lab), sounds (made by `lib/sound.ts`) and scripts |
| `text-effects.ts` | The floating text sprites: a letter font (Scratch's Marker font with an outline) and three styles |
| `cartoon-art.ts` | Pencil-style artwork for the cartoon smoke and explosion |
| `build.ts` | Writes `effects/*.sprite3`, `effects/sounds/*.wav`, `effects-demo.sb3` and `index.html` |
| `effects/` | The sprite files; the pictures (`*.png`) come from `tests/fx-sprites.test.ts` |

## How the effect sprites work

- **When the green flag is clicked**, the sprite hides. It never plays itself, only its clones do.
- **To play one**, any sprite sets the variables for all sprites `fx x` and `fx y`, then
  `create clone of [FX Explosion v]`. The clone goes there, starts its sound, plays and deletes itself.
- **Uploading** the first effect sprite into a project makes `fx x` and `fx y` (Scratch creates the variables for
  all sprites that an uploaded sprite uses); the next ones use the same two variables.
- **Effects with several pieces** (Ring, Sparks, Smoke, Debris, Explosion): the clone you make is the emitter (its
  local `role` is empty). It makes the pieces as clones of itself with a role, and stays (hidden) until its sound is
  over, because deleting a clone stops its sound.

## Floating text sprites

Set the variable for all sprites `fx text` (as well as `fx x` and `fx y`), then `create clone of [FX Float Text v]`.
The clone copies the text and makes one clone per character, each with its costume and its place (`i` of `n`), so
the letters can move one by one. Characters without a costume (a space too) leave a gap.
