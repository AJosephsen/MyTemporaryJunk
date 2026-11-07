// Builds deep-dig.sb3: an original digging game. A miner digs down through the soil, collects gold and gems, and
// must not be hit by falling rocks. Every ladder leads one level deeper, where rarer treasure lies.
//
// The mine is the list `world` (15 x 10 squares, index = row * 15 + col + 1) holding square codes (see art.ts).
// Every square is a clone of the Board sprite that shows the costume for its code. The Stage broadcasts `tick`
// every frame; every 6th frame its custom block `rocks fall` (run without screen refresh) moves the rocks.
// A rock that is falling (list `falling`) and lands on the miner costs a life; a resting rock is harmless.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { art, CELL, COLS, ROWS, LEFT, TOP, EMPTY, DIRT, ROCK, WALL, GOLD, CRYSTAL, RUBY, DIAMOND, LADDER, VALUE } from "./art.ts";

const P = new Project();
const FALL_EVERY = 6;        // frames between rock moves
const DIG_PAUSE = 4;         // frames between miner steps
const PUSH_PAUSE = 8;

type D = ReturnType<typeof dsl>;
const idx = (d: D, col: In, row: In) => d.add(d.add(d.mul(row, COLS), col), 1);

// ---------------------------------------------------------------- Stage: the clock, the level maker and the rocks
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, eq, gt, lt, or, and, not, set, change, ifThen, ifElse, item, replace, addTo, deleteAll,
    random, mod, repeat, forever, whenFlag, whenReceive, broadcast, broadcastWait, define, call } = d;
  const at = (i: In) => item("world", i);

  B.script(whenFlag(), [
    set("score", 0), set("lives", 3), set("level", 1), set("phase", "wait"), set("crushed", 0),
    broadcastWait("build board"),
    call("new level"),
    forever([
      change("frame", 1),
      ifThen(eq(v("phase"), "play"), [ifThen(eq(mod(v("frame"), FALL_EVERY), 0), [call("rocks fall")])]),
      ifThen(eq(v("phase"), "ouch"), [
        change("wait", -1),
        ifThen(eq(v("wait"), 0), [ifElse(gt(v("lives"), 0), [call("new level")], [set("phase", "over")])]),
      ]),
      broadcast("tick"),
    ]),
  ], 20, 20);
  B.script(whenReceive("deeper"), [change("level", 1), call("new level")], 20, 520);

  // A new mine: walls around the edge, then for every square a roll of the dice. Rubies only from level 2,
  // diamonds only from level 3.
  define("new level", [
    deleteAll("world"), deleteAll("falling"),
    set("depth", d.mul(v("level"), 25)),
    set("row", 0),
    repeat(ROWS, [
      set("col", 0),
      repeat(COLS, [
        ifElse(or(or(eq(v("row"), 0), eq(v("row"), ROWS - 1)), or(eq(v("col"), 0), eq(v("col"), COLS - 1))),
          [addTo("world", WALL)],
          [
            set("dice", random(1, 100)),
            set("square", DIRT),
            ifThen(lt(v("dice"), 15), [set("square", ROCK)]),
            ifThen(and(gt(v("dice"), 14), lt(v("dice"), 21)), [set("square", GOLD)]),
            ifThen(and(gt(v("dice"), 20), lt(v("dice"), 24)), [set("square", CRYSTAL)]),
            ifThen(and(gt(v("level"), 1), and(gt(v("dice"), 23), lt(v("dice"), 26))), [set("square", RUBY)]),
            ifThen(and(gt(v("level"), 2), eq(v("dice"), 26)), [set("square", DIAMOND)]),
            addTo("world", v("square")),
          ]),
        addTo("falling", 0),
        change("col", 1),
      ]),
      change("row", 1),
    ]),
    // The miner starts in the top-left corner; the ladder down is somewhere in the bottom row.
    set("mx", 1), set("my", 1), replace("world", idx(d, 1, 1), EMPTY),
    replace("world", idx(d, random(1, COLS - 2), ROWS - 2), LADDER),
    set("crushed", 0), set("cool", 0), set("phase", "play"),
  ], { warp: true, x: 520, y: 20 });

  // Rocks fall into empty squares, and roll off other rocks. Rows are done from the bottom up, so a rock moves
  // at most one square per turn. A rock that rolls right skips the square it lands in.
  const pi = () => v("me");
  const freeAt = (i: In) => and(eq(at(i), EMPTY), not(eq(i, pi())));
  const moveRock = (from: In, to: In) => [replace("world", to, ROCK), replace("world", from, EMPTY),
    replace("falling", to, 1), replace("falling", from, 0)];
  define("rocks fall", [
    set("me", idx(d, v("mx"), v("my"))),
    set("row", ROWS - 2),
    repeat(ROWS - 2, [
      set("col", 1),
      repeat(COLS - 2, [
        set("i", idx(d, v("col"), v("row"))),
        ifThen(eq(at(v("i")), ROCK), [
          set("below", add(v("i"), COLS)),
          ifElse(freeAt(v("below")), moveRock(v("i"), v("below")), [
            ifElse(and(eq(v("below"), pi()), eq(item("falling", v("i")), 1)), [set("crushed", 1)], [
              replace("falling", v("i"), 0),
              ifThen(eq(at(v("below")), ROCK), [
                ifElse(and(freeAt(sub(v("i"), 1)), freeAt(sub(v("below"), 1))), moveRock(v("i"), sub(v("i"), 1)), [
                  ifThen(and(freeAt(add(v("i"), 1)), freeAt(add(v("below"), 1))),
                    [...moveRock(v("i"), add(v("i"), 1)), change("col", 1)]),
                ]),
              ]),
            ]),
          ]),
        ]),
        change("col", 1),
      ]),
      change("row", -1),
    ]),
  ], { warp: true, x: 1100, y: 20 });
  return B;
}

// ---------------------------------------------------------------- Board: one clone per square
function boardScripts(): Blocks {
  const B = new Blocks(P).local("me", "isClone");
  const d = dsl(B);
  const { v, add, sub, mul, eq, set, change, repeat, ifThen, goto, cloneMyself, whenFlag, whenReceive, whenCloned,
    hide, show, costumeTo, item, define, call } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
  B.script(whenReceive("build board"), [ifThen(eq(v("isClone"), 0), [call("make squares")])], 20, 120);
  define("make squares", [
    set("me", 1), set("row", 0),
    repeat(ROWS, [
      set("col", 0),
      repeat(COLS, [goto(add(LEFT, mul(v("col"), CELL)), sub(TOP, mul(v("row"), CELL))), cloneMyself(),
        change("me", 1), change("col", 1)]),
      change("row", 1),
    ]),
  ], { warp: true, x: 400, y: 20 });
  B.script(whenCloned(), [set("isClone", 1), show()], 20, 300);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [costumeTo(add(item("world", v("me")), 1))])], 20, 400);
  return B;
}

// ---------------------------------------------------------------- Miner: arrow keys dig, collect and push
function minerScripts(): Blocks {
  const B = new Blocks(P);
  const d = dsl(B);
  const { v, add, sub, mul, eq, gt, lt, and, or, not, set, change, ifThen, ifElse, key, item, replace, goto, costumeTo,
    whenFlag, whenReceive, broadcast, define, call, say, front } = d;
  B.script(whenFlag(), [front(), say("")], 20, 20);
  B.script(whenReceive("tick"), [
    ifThen(eq(v("phase"), "play"), [
      ifElse(gt(v("cool"), 0), [change("cool", -1)], [
        set("dx", 0), set("dy", 0),
        ifThen(key("right arrow"), [set("dx", 1), d.costume("right")]),
        ifThen(key("left arrow"), [set("dx", -1), d.costume("left")]),
        ifThen(key("up arrow"), [set("dy", -1)]),
        ifThen(key("down arrow"), [set("dy", 1)]),
        ifThen(not(eq(v("dx"), 0)), [set("dy", 0)]),
        ifThen(not(and(eq(v("dx"), 0), eq(v("dy"), 0))), [call("step")]),
      ]),
      ifThen(eq(v("crushed"), 1), [
        change("lives", -1), set("crushed", 0), set("phase", "ouch"), set("wait", 45),
        ifElse(gt(v("lives"), 0), [say("Ouch!")], [say("Game over!")]),
      ]),
    ]),
    ifThen(eq(v("phase"), "play"), [say("")]),
    goto(add(LEFT, mul(v("mx"), CELL)), sub(TOP, mul(v("my"), CELL))),
  ], 20, 120);

  // One step: dig dirt, collect treasure, climb down a ladder, or push a rock sideways into an empty square.
  const go = (pause: number) => [change("mx", v("dx")), change("my", v("dy")), set("cool", pause)];
  define("step", [
    set("to", idx(d, add(v("mx"), v("dx")), add(v("my"), v("dy")))),
    set("what", item("world", v("to"))),
    ifThen(eq(v("what"), LADDER), [broadcast("deeper")]),
    ifThen(or(eq(v("what"), EMPTY), eq(v("what"), DIRT)), [replace("world", v("to"), EMPTY), ...go(DIG_PAUSE)]),
    ifThen(and(gt(v("what"), WALL), lt(v("what"), LADDER)), [
      change("score", item("value", add(v("what"), 1))), replace("world", v("to"), EMPTY), ...go(DIG_PAUSE),
    ]),
    ifThen(and(eq(v("what"), ROCK), eq(v("dy"), 0)), [
      ifThen(eq(item("world", add(v("to"), v("dx"))), EMPTY), [
        replace("world", add(v("to"), v("dx")), ROCK), replace("world", v("to"), EMPTY), ...go(PUSH_PAUSE),
      ]),
    ]),
  ], { warp: true, x: 520, y: 20 });
  return B;
}

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Board", { blocks: boardScripts(), costumes: A.tiles, layer: 1, visible: false }),
    P.sprite("Miner", { blocks: minerScripts(), costumes: A.miner, layer: 2, x: LEFT + CELL, y: TOP - CELL }),
  ],
  listValues: { value: Array.from({ length: 9 }, (_, i) => VALUE[i] ?? 0), world: [], falling: [] },
  shown: ["score", "depth", "lives"],
});
writeFileSync(new URL("deep-dig.sb3", import.meta.url), sb3);
console.log(`deep-dig.sb3: ${sb3.length} bytes`);
void [GOLD, CRYSTAL, RUBY, DIAMOND];
