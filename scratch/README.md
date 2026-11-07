# Scratch

All Scratch work lives here.

| Folder | Contents |
|---|---|
| `games/` | Scratch games, each in its own folder with a `build.ts` that generates the `.sb3` file |
| `tools/` | Tools for working with Scratch projects |
| `tutorials/` | Step-by-step tutorials, each with a page (`index.html`) and checkpoint `.sb3` files |
| `lib/` | Shared TypeScript library for generating `.sb3` files (`sb3.ts`) |
| `workbench/` | Local player with live reload, and the headless test runner |
| `tests/` | Headless tests (`*.test.ts`) |
| `examples/` | Downloaded projects used for study (add as needed) |

## Games

| Game | Description |
|---|---|
| [Dust Hopper](games/dust-hopper/) | Single-screen landing game using the physics model of the 1979 arcade lander |

## Tutorials

| Tutorial | Description |
|---|---|
| [Dust Hopper](tutorials/dust-hopper/) | Build the landing game by hand in 8 steps, with a checkpoint file per step |

## Tools

| Tool | Description |
|---|---|
| [pseudocode](tools/pseudocode/) | Converts a Scratch 3 `project.json` into readable pseudocode |
| [scratchblocks](tools/scratchblocks/) | Converts a Scratch 3 `project.json` into scratchblocks text, for drawing blocks on web pages |

## Conventions

- Each game folder holds `build.ts`, its artwork module,, the generated `.sb3`, a `README.md` and a `screenshot.png`.
- Scripts are TypeScript, run with `node --experimental-strip-types` (Node 22 or later), with no packages.
- Games are original: classic games may be studied for their mechanics, but names, characters and art are our own.

## Workbench: run and test locally

Everything runs locally with the TurboWarp runtime, a fast, Scratch-compatible engine. scratch.mit.edu is not needed.

### Setup (once)

```
cd scratch
npm install
npx playwright install chromium   # browser for headless tests; skip if Chromium for Playwright 1.63 is installed
```

Node 22.6 or later is required.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Builds every project, then serves the player at http://127.0.0.1:8080/ with live reload: saving a build script, the library, artwork or a template rebuilds the projects and reloads open players |
| `npm run build` | Runs every `build.ts` / `build-steps.ts` |
| `npm test` | Runs all tests headlessly (about 25 s). `npm test -- landing` runs tests whose name contains "landing"; add `--verbose` for test logs |
| `npm run check` | TypeScript type check |
| `npm run export -- out.html [projects…]` | Writes one standalone, playable HTML page with the projects embedded (default: Dust Hopper and its checkpoints). The runtime loads from jsDelivr; the compiler is off so it works without `eval`. Output in `export/` is not committed |
| `npm run export:game -- games/<name> [out.html]` | Writes the finished, publishable page for one game, described by `games/<name>/page.json` (title, tagline, project, on-screen buttons, keyboard hint). Landscape: stage at full height with buttons at the sides. Portrait: stage on top, buttons at the bottom. Full screen button with a fill-the-window fallback where real full screen is not allowed; in full screen the stage fills the screen and the controls float over it |

In VS Code, open the player in the built-in browser: *Command Palette › Simple Browser: Show* and enter the URL.
Tasks for all commands are in `.vscode/tasks.json`, and `.vscode/launch.json` can debug a build script or the tests.

### Writing tests

Tests live in `tests/*.test.ts`. After the green flag, game time only moves when the test says so, one frame
(1/30 s) at a time, so tests are fast and give the same result every run.

```ts
import { test } from "../workbench/testing.ts";

test("drone falls", async t => {
  await t.load("games/dust-hopper/dust-hopper.sb3");
  await t.greenFlag();
  const v = await t.until(v => v.state === "flying", { max: 400 });  // runs inside the page
  await t.frames(30);                                                   // one second of game time
  t.expect((await t.get("Descent")) > 0, "falling");
  t.expect((await t.sprite("Drone")).costume === "drone", "plain costume");
});
```

| Method | Purpose |
|---|---|
| `load(path)`, `greenFlag()` | Load a project (path relative to `scratch/`) and start it |
| `frames(n)` | Run exactly n frames |
| `until(check, { max })` | Run frame by frame until `check(v, w, memo)` is true. It runs inside the page: `v` holds all variables and lists, `w.key(name, down)` presses keys, `memo` keeps values between frames |
| `vars()`, `get(name)`, `set(name, value)` | Read and change variables and lists |
| `hold(key)`, `release(key)` | Keys by Scratch name: `"up arrow"`, `"space"`, … |
| `sprite(name)` | Position, direction, costume, visibility and speech bubble text |
| `page(fn)` | Run code in the page; `w.vm` is the Scratch VM |
| `screenshot(file)`, `expect(ok, msg)`, `near(a, b, tol, label)`, `log(...)` | Helpers |

How it works: the test page stops the engine's own timer and runs on a virtual clock. Each step moves time on by
exactly one frame, runs due timers (used by blocks like *say for 2 seconds*), then runs one engine frame.

Scratch detail worth knowing: when nothing on screen needs redrawing, Scratch re-runs loops several times within one
frame until most of the frame's time is used. A `forever` loop that only broadcasts can therefore fire several times
per frame when nothing moves. In Dust Hopper this is harmless, because the drone moves on every tick while flying.
