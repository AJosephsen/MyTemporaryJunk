// Builds the Maze Maker tutorial: a digger draws a maze with the pen. One idea per step:
//   1  draw tunnels with the pen (a random walk)
//   2  peek before digging: `touching color` tells where we have already dug
//   3  go back and try another way: a custom block that calls itself (recursion) finishes the maze
//   4  run without screen refresh: the same blocks build the maze instantly
// The grid is 12 x 9 cells of 34 pixels; cell centres run from x -187..187 and y 136..-136. A step off the grid
// still fits on the Stage, so the Stage never pushes the digger back (which would move it off the grid).
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { buildTutorial } from "../../lib/tutorial.ts";

const LAST = 4;
export const CELL = 34, COLS = 12, ROWS = 9, START_X = -187, START_Y = 136;
export const SAND = "#f2d58c", SOIL = "#5b3a26";

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// Soil with a few darker pebbles (never close to the sand colour, so `touching color` only sees tunnels).
const pebbles = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 97) % 480, y = (i * 53 + (i % 7) * 31) % 360, r = 2 + (i % 4);
  return `<ellipse cx="${x}" cy="${y}" rx="${r + 1}" ry="${r}" fill="#4a2e1e"/>`;
}).join("");
const backdrop = svg(480, 360, `<rect width="480" height="360" fill="${SOIL}"/>${pebbles}`);
// The digger: a small mole, 24 pixels wide, facing right (direction 90).
const mole = svg(28, 24,
  `<ellipse cx="12" cy="12" rx="11" ry="10" fill="#6d6875"/>` +
  `<ellipse cx="22" cy="12" rx="5" ry="4" fill="#b5838d"/><circle cx="26" cy="12" r="2" fill="#e5989b"/>` +
  `<circle cx="16" cy="8" r="1.6" fill="#1b1b1b"/><circle cx="16" cy="16" r="1.6" fill="#1b1b1b"/>` +
  `<path d="M8 3 l-3 -2 M8 21 l-3 2" stroke="#4a4550" stroke-width="2"/>`);

function digger(step: number, B: Blocks) {
  const d = dsl(B);
  const { whenFlag, penClear, penSize, penColor, penDown, penUp, goto, point, move, repeat, random, mul, add, ifThen,
    ifElse, not, or, gt, abs, xPos, yPos, touchingColor, define, call, arg } = d;
  const setup = [penClear(), penUp(), penSize(22), penColor(SAND), goto(START_X, START_Y), point(90), penDown(), penUp()];
  const outside = () => or(gt(abs(xPos()), 200), gt(abs(yPos()), 150));

  if (step <= 2) {
    // Peek: step forward with the pen up. Off the grid (or, from step 2, already dug)? Step back.
    // Otherwise step back, put the pen down and dig forward.
    const blocked = step === 1 ? outside() : or(outside(), touchingColor(SAND));
    B.script(whenFlag(), [...setup,
      repeat(step === 1 ? 60 : 150, [
        point(mul(random(0, 3), 90)), move(CELL),
        ifElse(blocked, [move(-CELL)], [move(-CELL), penDown(), move(CELL), penUp()]),
        d.wait(0.05),
      ])]);
    return;
  }
  // One block that calls itself: try one way from cell (x, y). If the cell there is new, dig to it and start trying
  // from there. Then try the next way from (x, y), until no ways are left. Going back happens by itself: when a call
  // ends, the call that made it carries on from its own cell.
  const warp = step >= 4;
  B.script(whenFlag(), [...setup, call("try %s %s %s %s", START_X, START_Y, mul(random(0, 3), 90), 4),
    goto(START_X, START_Y), point(90)]);
  define("try %s %s %s %s", [
    goto(arg("x"), arg("y")), point(arg("direction")), move(CELL),
    ifThen(not(or(touchingColor(SAND), outside())), [
      move(-CELL), penDown(), move(CELL), penUp(),
      call("try %s %s %s %s", xPos(), yPos(), mul(random(0, 3), 90), 4),
    ]),
    ifThen(gt(arg("ways left"), 1), [
      call("try %s %s %s %s", arg("x"), arg("y"), add(arg("direction"), 90), d.sub(arg("ways left"), 1)),
    ]),
  ], { warp, args: ["x", "y", "direction", "ways left"], x: 400, y: 20 });
}

function checkpoint(step: number): Buffer {
  const P = new Project();
  const B = new Blocks(P);
  if (step >= 1) digger(step, B);
  return P.build({
    backdrop: P.costume("soil", backdrop, 240, 180),
    sprites: [P.sprite("Digger", { blocks: B, costumes: [P.costume("mole", mole, 12, 12)], layer: 1, x: START_X, y: START_Y })],
  });
}

buildTutorial(new URL(".", import.meta.url), LAST, checkpoint, ["Stage", "Digger"]);
