# Scratch

All Scratch work lives here.

| Folder | Contents |
|---|---|
| `games/` | Scratch games, each in its own folder with a `build.ts` that generates the `.sb3` file |
| `tools/` | Tools for working with Scratch projects |
| `examples/` | Downloaded projects used for study (add as needed) |

## Games

| Game | Description |
|---|---|
| [Dust Hopper](games/dust-hopper/) | Single-screen landing game using the physics model of the 1979 arcade lander |

## Tools

| Tool | Description |
|---|---|
| [pseudocode](tools/pseudocode/) | Converts a Scratch 3 `project.json` into readable pseudocode |

## Conventions

- Each game folder holds `build.ts`, the generated `.sb3`, a `README.md` and a `screenshot.png`.
- Scripts are TypeScript, run with `node --experimental-strip-types` (Node 22 or later), with no packages.
- Games are original: classic games may be studied for their mechanics, but names, characters and art are our own.
