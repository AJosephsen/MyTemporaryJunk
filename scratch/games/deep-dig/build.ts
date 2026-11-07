// Builds deep-dig.sb3: an original digging game for young Scratchers. A miner digs down through the soil, collects
// gold and gems, and must not be hit by falling rocks. Every ladder leads one level deeper, to rarer treasure.
//
// No lists: everything works by looking. Dirt, Rock, Gem and Ladder are sprites whose clones sit on a grid of
// 32-pixel squares; the walls are painted on the backdrop.
//   - The Miner takes a step, looks (touching the wall colour or a Rock?) and steps back if it is blocked.
//   - Every Dirt and Gem clone waits until it touches the Miner, then disappears (a gem adds its points first).
//   - Every Rock clone steps down every 0.2 seconds and looks: blocked means step back up (and, sitting on another
//     rock, try to roll off to the side). A rock that was already falling and touches the Miner hurts him.
//     Rocks spot other rocks by their grey (`touching color`): a sprite cannot pick itself in "touching".
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { art, CELL, COLS, ROWS, LEFT, TOP, ROCK_GREY, WALL_COLOR, SOIL_BROWN, TREASURE } from "./art.ts";

const P = new Project();
type D = ReturnType<typeof dsl>;
// Squares inside the walls: columns 1..13, rows 1..8.
const squareX = (d: D, col: In) => d.add(LEFT, d.mul(col, CELL));
const squareY = (d: D, row: In) => d.sub(TOP, d.mul(row, CELL));
const randomSquare = (d: D) => d.goto(squareX(d, d.random(1, COLS - 2)), squareY(d, d.random(1, ROWS - 2)));
const START: [number, number] = [LEFT + CELL, TOP - CELL];

// ---------------------------------------------------------------- Stage: levels, lives, depth
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, gt, eq, set, change, ifThen, ifElse, whenFlag, whenReceive, broadcast, broadcastWait, wait } = d;
  B.script(whenFlag(), [set("score", 0), set("lives", 3), set("level", 1), broadcast("new level")], 20, 20);
  B.script(whenReceive("new level"), [
    set("phase", "build"), set("depth", d.mul(v("level"), 25)),
    broadcastWait("clear"),       // old clones go, the Miner goes back to the start
    broadcastWait("place"),       // rocks, gems and the ladder go to random squares
    broadcastWait("fill dirt"),   // dirt everywhere else
    set("phase", "play"),
  ], 20, 140);
  B.script(whenReceive("deeper"), [change("level", 1), broadcast("new level")], 20, 420);
  B.script(whenReceive("ouch"), [
    ifThen(eq(v("phase"), "play"), [
      set("phase", "ouch"), change("lives", -1), wait(1.5),
      ifElse(gt(v("lives"), 0), [broadcast("new level")], [set("phase", "game over")]),
    ]),
  ], 20, 520);
  return B;
}

// ---------------------------------------------------------------- Miner: step, look, step back if blocked
function minerScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, eq, or, set, ifThen, ifElse, key, goto, whenFlag, whenReceive, forever, changeX, changeY, wait, say,
    touching, touchingColor, costume, front, define, call, broadcast } = d;
  B.script(whenReceive("clear"), [goto(...START), costume("right"), front(), say("")], 20, 20);
  B.script(whenReceive("ouch"), [say("Ouch!")], 20, 120);
  // After a step: blocked by a wall or a rock? Then step back. On the ladder? Then go deeper.
  define("look %s %s", [
    ifElse(or(touchingColor(WALL_COLOR), touching("Rock")), [changeX(d.mul(d.arg("dx"), -1)), changeY(d.mul(d.arg("dy"), -1))], [
      ifThen(touching("Ladder"), [broadcast("deeper")]),
      wait(0.12),
    ]),
  ], { args: ["dx", "dy"], x: 400, y: 20 });
  B.script(whenFlag(), [
    forever([
      ifThen(eq(v("phase"), "play"), [
        ifElse(key("right arrow"), [costume("right"), changeX(CELL), call("look %s %s", CELL, 0)], [
          ifElse(key("left arrow"), [costume("left"), changeX(-CELL), call("look %s %s", -CELL, 0)], [
            ifElse(key("down arrow"), [changeY(-CELL), call("look %s %s", 0, -CELL)], [
              ifThen(key("up arrow"), [changeY(CELL), call("look %s %s", 0, CELL)]),
            ]),
          ]),
        ]),
      ]),
    ]),
  ], 20, 220);
  void set;
  return B;
}

// ---------------------------------------------------------------- Dirt: fills every square, goes when dug
function dirtScripts(): Blocks {
  const B = new Blocks(P).local("isClone");
  const d = dsl(B);
  const { v, eq, or, set, change, repeat, ifThen, goto, cloneMyself, deleteClone, whenFlag, whenReceive, whenCloned,
    hide, show, touching, waitUntil, define, call } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
  B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);
  B.script(whenReceive("fill dirt"), [ifThen(eq(v("isClone"), 0), [call("fill")])], 20, 180);
  define("fill", [
    set("row", 1),
    repeat(ROWS - 2, [
      set("col", 1),
      repeat(COLS - 2, [goto(squareX(d, v("col")), squareY(d, v("row"))), cloneMyself(), change("col", 1)]),
      change("row", 1),
    ]),
  ], { warp: true, x: 420, y: 20 });
  B.script(whenCloned(), [
    set("isClone", 1), show(),
    // Something is already here? Then no dirt. (Show first: a hidden sprite touches nothing.)
    ifThen(or(or(touching("Rock"), touching("Gem")), or(touching("Ladder"), touching("Miner"))), [deleteClone()]),
    waitUntil(touching("Miner")),
    deleteClone(),
  ], 20, 300);
  return B;
}

// ---------------------------------------------------------------- Rock: falls and rolls
function rockScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "falling", "blocked");
  const d = dsl(B);
  const { v, eq, or, not, set, repeat, ifThen, ifElse, deleteClone, cloneMyself, whenFlag, whenReceive, whenCloned,
    hide, show, touching, touchingColor, waitUntil, forever, wait, changeX, changeY, broadcast, define, call, stopThis } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
  B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);
  B.script(whenReceive("place"), [ifThen(eq(v("isClone"), 0), [call("scatter")])], 20, 180);
  define("scatter", [repeat(18, [randomSquare(d), cloneMyself()])], { warp: true, x: 420, y: 680 });
  // Is the square I'm in now taken? (Dirt, a gem, the ladder, the wall or another rock.)
  define("look", [
    set("blocked", or(or(or(touching("Dirt"), touching("Gem")), or(touching("Ladder"), touchingColor(WALL_COLOR))),
      touchingColor(ROCK_GREY))),
  ], { x: 420, y: 20 });
  // Roll one square sideways and down, if both squares are free. dx is -32 (left) or 32 (right).
  define("roll %s", [
    changeX(d.arg("dx")), call("look"),
    ifThen(not(or(eq(v("blocked"), "true"), touching("Miner"))), [
      changeY(-CELL), call("look"),
      ifThen(not(or(eq(v("blocked"), "true"), touching("Miner"))), [set("falling", 1), stopThis()]),
      changeY(CELL),
    ]),
    changeX(d.mul(d.arg("dx"), -1)),
  ], { args: ["dx"], x: 420, y: 160 });
  define("fall", [
    changeY(-CELL),
    ifElse(touching("Miner"), [
      changeY(CELL),
      ifThen(eq(v("falling"), 1), [broadcast("ouch")]),
      set("falling", 0),
    ], [
      call("look"),
      ifThen(eq(v("blocked"), "true"), [
        set("onRock", touchingColor(ROCK_GREY)),
        changeY(CELL), set("falling", 0),
        ifThen(eq(v("onRock"), "true"), [call("roll %s", -CELL), ifThen(eq(v("falling"), 0), [call("roll %s", CELL)])]),
      ]),
      ifThen(eq(v("blocked"), "false"), [set("falling", 1)]),
    ]),
  ], { x: 420, y: 420 });
  B.script(whenCloned(), [
    set("isClone", 1), set("falling", 0), show(),
    // On the ladder, the Miner or another rock? Then this rock goes.
    ifThen(or(or(touching("Ladder"), touching("Miner")), touchingColor(ROCK_GREY)), [deleteClone()]),
    waitUntil(eq(v("phase"), "play")),
    forever([wait(0.2), ifThen(eq(v("phase"), "play"), [call("fall")])]),
  ], 20, 300);
  return B;
}

// ---------------------------------------------------------------- Gem: treasure, rarer the deeper you are
function gemScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "value");
  const d = dsl(B);
  const { v, eq, gt, lt, or, and, set, change, repeat, ifThen, deleteClone, cloneMyself, whenFlag, whenReceive, whenCloned,
    hide, show, touching, waitUntil, costume } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
  B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);
  B.script(whenReceive("place"), [ifThen(eq(v("isClone"), 0), [d.call("scatter")])], 20, 180);
  d.define("scatter", [repeat(14, [randomSquare(d), cloneMyself()])], { warp: true, x: 420, y: 20 });
  const kind = (name: string, value: number) => [costume(name), set("value", value)];
  B.script(whenCloned(), [
    set("isClone", 1), show(),
    // On the ladder, the Miner, a rock or another gem (its brown soil)? Then this gem goes.
    ifThen(or(or(touching("Ladder"), touching("Miner")), or(touching("Rock"), d.touchingColor(SOIL_BROWN))), [deleteClone()]),
    // Most treasure is gold. Crystals are rarer; rubies only from level 2, diamonds only from level 3.
    set("dice", d.random(1, 20)),
    ...kind(TREASURE[0].name, TREASURE[0].value),
    ifThen(gt(v("dice"), 13), kind(TREASURE[1].name, TREASURE[1].value)),
    ifThen(and(gt(v("level"), 1), gt(v("dice"), 17)), kind(TREASURE[2].name, TREASURE[2].value)),
    ifThen(and(gt(v("level"), 2), eq(v("dice"), 20)), kind(TREASURE[3].name, TREASURE[3].value)),
    waitUntil(touching("Miner")),
    change("score", v("value")),
    deleteClone(),
  ], 20, 300);
  void lt;
  return B;
}

// ---------------------------------------------------------------- Ladder: one per level, in the bottom row
function ladderScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenReceive("place"), [d.goto(squareX(d, d.random(1, COLS - 2)), squareY(d, ROWS - 2)), d.show()], 20, 20);
  return B;
}

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Ladder", { blocks: ladderScripts(), costumes: A.ladder, layer: 1 }),
    P.sprite("Dirt", { blocks: dirtScripts(), costumes: A.dirt, layer: 2, visible: false }),
    P.sprite("Gem", { blocks: gemScripts(), costumes: A.gems, layer: 3, visible: false }),
    P.sprite("Rock", { blocks: rockScripts(), costumes: A.rock, layer: 4, visible: false }),
    P.sprite("Miner", { blocks: minerScripts(), costumes: A.miner, layer: 5, x: START[0], y: START[1] }),
  ],
  shown: ["score", "depth", "lives"],
});
writeFileSync(new URL("deep-dig.sb3", import.meta.url), sb3);
console.log(`deep-dig.sb3: ${sb3.length} bytes`);
