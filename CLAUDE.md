# Repository notes

All Scratch work is in `scratch/`. See `scratch/README.md`.

## Development loop for Scratch projects

Projects are generated from TypeScript: never edit `.sb3` files, `index.html` (tutorials) or `blocks.json` by hand.

```
cd scratch
npm install                 # once per checkout
npm run build               # regenerate every project after a change
npm test                    # headless tests in the TurboWarp runtime, about 25 s
npm run check               # type check
```

- Use `npm test` instead of the scratch.mit.edu editor to check behaviour. Add or update tests in `scratch/tests/`
  when a game's behaviour changes.
- `t.until(...)` checks run inside the browser page: they can only use their arguments (v, w, memo).
- A game's result handling often runs in the same frame as the event that caused it (for example the
  touchdown frame already includes the score change).
- Games are original: classic games may be studied for mechanics, but names, characters and art are new.

## Working with the user

- The user often follows along on a phone. Share screenshots in the chat (SendUserFile), not only at the end:
  also during development, whenever something visible changes (a new step, a fix, a page layout).
