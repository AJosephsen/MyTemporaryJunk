// Builds lantern-deep.sb3: an original, endless digging game. The miner digs down and down; squares only show what
// they really are once his lantern lights them. Deeper squares are harder and hold better treasure.
//
// No lists. Squares are clones of the Square sprite; each clone keeps its own row, col, kind, hp and value
// (a clone copies the sprite's own variables when it is made, so the Square sprite sets them, then clones itself).
// Rows are numbered from the top (row 0) down; `scroll` moves everything up as the miner digs deeper.
//   - Lantern: a glow around the miner. A square touching it is lit and shows its real costume.
//   - Pick: an invisible dot. To dig, the miner puts it on the square he faces and broadcasts `dig`;
//     the square touching the Pick takes the hit. If nothing was hit, the square is empty and the miner steps in.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { art, CELL, COLS, LEFT, KINDS, KIND } from "./art.ts";

const P = new Project();
type D = ReturnType<typeof dsl>;
const ROW0 = 124;            // screen y of row 0 when scroll is 0
const AHEAD = 9;             // rows made below the miner
const MINER_ROW_ON_SCREEN = 3;
const START_COL = 7;
const screenX = (d: D, col: In) => d.add(LEFT, d.mul(col, CELL));
const screenY = (d: D, row: In) => d.add(d.sub(ROW0, d.mul(row, CELL)), d.v("scroll"));

// ---------------------------------------------------------------- Stage: start, scrolling
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, sub, mul, gt, set, change, ifThen, whenFlag, forever, broadcast, broadcastWait } = d;
  B.script(whenFlag(), [
    set("coins", 0), set("power", 1), set("depth", 0), set("mrow", 0), set("mcol", START_COL), set("scroll", 0),
    set("lastRow", -1), set("phase", "play"),
    broadcastWait("clear"),
    forever([
      // The view follows the miner down, smoothly: the miner stays near the top of the screen.
      set("target", mul(sub(v("mrow"), MINER_ROW_ON_SCREEN), CELL)),
      ifThen(gt(0, v("target")), [set("target", 0)]),
      change("scroll", d.div(sub(v("target"), v("scroll")), 4)),
      set("depth", v("mrow")),
      broadcast("tick"),
    ]),
  ], 20, 20);
  return B;
}

// ---------------------------------------------------------------- Square: made row by row, lit by the lantern, dug by the pick
function squareScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "row", "col", "kind", "hp", "value", "lit");
  const d = dsl(B);
  const { v, add, sub, eq, gt, lt, and, or, not, set, change, repeat, ifThen, ifElse, until, whenFlag, whenReceive,
    whenCloned, cloneMyself, deleteClone, hide, show, goto, costumeTo, costume, touching, random, define, call } = d;
  const kind = (name: keyof typeof KIND) => {
    const k = KINDS[KIND[name] - 1];
    return [set("kind", KIND[name]), set("hp", k.hp), set("value", k.value)];
  };
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
  B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);

  // The Square sprite itself keeps making rows until there are enough below the miner.
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 0), [call("make rows")])], 20, 180);
  define("make rows", [
    until(not(lt(v("lastRow"), add(v("mrow"), AHEAD))), [
      change("lastRow", 1), set("row", v("lastRow")), set("col", 0),
      repeat(COLS, [
      call("choose kind"),
      // Edges are bedrock; the miner's start square stays empty.
      ifThen(or(eq(v("col"), 0), eq(v("col"), COLS - 1)), kind("bedrock")),
      ifThen(not(and(eq(v("row"), 0), eq(v("col"), START_COL))), [cloneMyself()]),
      change("col", 1),
    ]),
    ]),
  ], { warp: true, x: 420, y: 20 });
  // What is in this square? Deeper rows have more stone and better treasure.
  define("choose kind", [
    ...kind("dirt"),
    ifThen(lt(random(1, 100), v("row")), kind("stone")),
    ifThen(lt(random(1, 100), sub(v("row"), 40)), kind("hardrock")),
    set("dice", random(1, 1000)),
    ifThen(lt(v("dice"), 40), kind("coal")),
    ifThen(and(gt(v("dice"), 39), lt(v("dice"), 70)), kind("copper")),
    ifThen(and(gt(v("row"), 12), and(gt(v("dice"), 69), lt(v("dice"), 90))), kind("silver")),
    ifThen(and(gt(v("row"), 25), and(gt(v("dice"), 89), lt(v("dice"), 105))), kind("gold")),
    ifThen(and(gt(v("row"), 45), and(gt(v("dice"), 104), lt(v("dice"), 112))), kind("ruby")),
    ifThen(and(gt(v("row"), 65), and(gt(v("dice"), 111), lt(v("dice"), 118))), kind("emerald")),
    ifThen(and(gt(v("row"), 90), and(gt(v("dice"), 117), lt(v("dice"), 121))), kind("diamond")),
  ], { warp: true, x: 420, y: 400 });

  B.script(whenCloned(), [set("isClone", 1), set("lit", 0), costume("dark"), show()], 20, 280);
  // Every frame: move with the scroll, go when far above the screen, and light up when the lantern reaches me.
  B.script(whenReceive("tick"), [
    ifThen(eq(v("isClone"), 1), [
      // Far above the screen? Then I'm not needed any more. (Use the sum, not y position: Scratch keeps sprites
      // on the Stage, so y position never gets that high.)
      ifThen(gt(screenY(d, v("row")), 200), [deleteClone()]),
      goto(screenX(d, v("col")), screenY(d, v("row"))),
      ifThen(and(eq(v("lit"), 0), touching("Lantern")), [set("lit", 1), costumeTo(add(v("kind"), 1))]),
    ]),
  ], 20, 360);
  // Hit by the pick: lose strength; when none is left, give my treasure and go.
  B.script(whenReceive("dig"), [
    ifThen(and(eq(v("isClone"), 1), touching("Pick")), [
      set("hit", 1),
      change("hp", d.mul(v("power"), -1)),
      ifThen(lt(v("hp"), 1), [change("coins", v("value")), deleteClone()]),
    ]),
  ], 20, 520);
  return B;
}

// ---------------------------------------------------------------- Miner: the arrow keys dig, and walk into empty squares
function minerScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, eq, gt, lt, and, not, set, change, ifThen, ifElse, key, goto, costume, whenFlag, whenReceive,
    broadcastWait, front, define, call } = d;
  // The Miner has its own loop, not a `tick` script: `broadcast and wait` takes a frame, and the next `tick`
  // would restart a tick script in the middle of it.
  define("try %s %s", [
    set("dx", d.arg("dx")), set("dy", d.arg("dy")),
    // Put the pick on the square I face, and ask that square to take a hit.
    d.broadcast("aim"), set("hit", 0), broadcastWait("dig"),
    ifElse(eq(v("hit"), 1), [set("cool", 6)], [
      ifThen(not(lt(add(v("mrow"), v("dy")), 0)), [change("mcol", v("dx")), change("mrow", v("dy"))]),
      set("cool", 4),
    ]),
  ], { args: ["dx", "dy"], x: 420, y: 20 });
  B.script(whenFlag(), [set("cool", 0), costume("right"), front(), d.forever([
    goto(screenX(d, v("mcol")), screenY(d, v("mrow"))),
    ifThen(eq(v("phase"), "play"), [
      ifElse(gt(v("cool"), 0), [change("cool", -1)], [
        ifElse(key("right arrow"), [costume("right"), call("try %s %s", 1, 0)], [
          ifElse(key("left arrow"), [costume("left"), call("try %s %s", -1, 0)], [
            ifElse(key("down arrow"), [call("try %s %s", 0, 1)], [
              ifThen(key("up arrow"), [call("try %s %s", 0, -1)]),
            ]),
          ]),
        ]),
      ]),
    ]),
  ])], 20, 120);
  void and; void whenReceive;
  return B;
}

// ---------------------------------------------------------------- Lantern and Pick follow the miner
function lanternScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenReceive("tick"), [d.goto(screenX(d, d.v("mcol")), screenY(d, d.v("mrow"))), d.front()], 20, 20);
  return B;
}
function pickScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.setEffect("GHOST", 100), d.show()], 20, 20);
  B.script(d.whenReceive("aim"), [
    d.goto(screenX(d, d.add(d.v("mcol"), d.v("dx"))), screenY(d, d.add(d.v("mrow"), d.v("dy")))),
  ], 20, 120);
  return B;
}

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Square", { blocks: squareScripts(), costumes: A.squares, layer: 1, visible: false }),
    P.sprite("Pick", { blocks: pickScripts(), costumes: A.pick, layer: 2 }),
    P.sprite("Miner", { blocks: minerScripts(), costumes: A.miner, layer: 3, x: LEFT + START_COL * CELL, y: ROW0 }),
    P.sprite("Lantern", { blocks: lanternScripts(), costumes: A.lantern, layer: 4, x: LEFT + START_COL * CELL, y: ROW0 }),
  ],
  shown: ["coins", "depth"],
});
writeFileSync(new URL("lantern-deep.sb3", import.meta.url), sb3);
console.log(`lantern-deep.sb3: ${sb3.length} bytes`);
