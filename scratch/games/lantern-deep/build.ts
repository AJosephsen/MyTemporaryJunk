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
    set("coins", 0), set("power", 1), set("pickLevel", 1), set("pickaxe", "wood"), set("cost", 40),
    set("hearts", 3), set("safe", 0),
    set("depth", 0), set("mrow", 0), set("mcol", START_COL), set("scroll", 0),
    set("lastRow", -1), set("phase", "play"),
    broadcastWait("clear"),
    forever([
      // The view follows the miner down, smoothly: the miner stays near the top of the screen.
      set("target", mul(sub(v("mrow"), MINER_ROW_ON_SCREEN), CELL)),
      ifThen(gt(0, v("target")), [set("target", 0)]),
      change("scroll", d.div(sub(v("target"), v("scroll")), 4)),
      set("depth", v("mrow")),
      ifThen(gt(v("safe"), 0), [change("safe", -1)]),
      broadcast("tick"),
    ]),
  ], 20, 20);
  // Hurt by lava or a crawler: lose a heart, then a short safe time.
  B.script(d.whenReceive("ouch"), [
    ifThen(d.and(d.eq(v("phase"), "play"), d.eq(v("safe"), 0)), [
      change("hearts", -1), set("safe", 45),
      ifThen(d.lt(v("hearts"), 1), [set("phase", "over")]),
    ]),
  ], 20, 520);
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
      // Deeper than row 20, some rows have a small cave: 5 empty squares with a crawler inside.
      set("cave", 0),
      ifThen(and(gt(v("row"), 20), lt(random(1, 100), 9)), [set("cave", 1), set("caveFrom", random(2, 8))]),
      repeat(COLS, [
      call("choose kind"),
      // Edges are bedrock; the miner's start square stays empty.
      ifThen(or(eq(v("col"), 0), eq(v("col"), COLS - 1)), kind("bedrock")),
      set("inCave", and(eq(v("cave"), 1), and(gt(v("col"), sub(v("caveFrom"), 1)), lt(v("col"), add(v("caveFrom"), 5))))),
      ifThen(not(or(and(eq(v("row"), 0), eq(v("col"), START_COL)), eq(v("inCave"), "true"))), [cloneMyself()]),
      change("col", 1),
    ]),
      ifThen(eq(v("cave"), 1), [set("crawlRow", v("row")), set("crawlCol", add(v("caveFrom"), 2)), d.broadcast("crawler")]),
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
    // Lava: from row 16, a little more often the deeper you are.
    ifThen(and(gt(v("row"), 15), and(gt(v("dice"), 960), lt(v("dice"), add(944, v("row"))))), kind("lava")),
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
      ifElse(eq(v("kind"), KIND.lava), [d.broadcast("ouch")], [
        change("hp", d.mul(v("power"), -1)),
        ifThen(lt(v("hp"), 1), [change("coins", v("value")), deleteClone()]),
      ]),
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
  const pick = (level: number, name: string, nextCost: number) =>
    ifThen(eq(v("pickLevel"), level), [set("pickaxe", name), set("cost", nextCost)]);
  // A better pickaxe hits twice as hard.
  define("upgrade", [
    change("coins", d.mul(v("cost"), -1)), change("pickLevel", 1), set("power", d.mul(v("power"), 2)),
    pick(2, "stone", 150), pick(3, "iron", 500), pick(4, "diamond", 0),
    d.say("New pickaxe!"), d.waitUntil(not(key("u"))),
  ], { x: 420, y: 300 });
  const canUpgrade = () => and(lt(v("pickLevel"), 4), not(lt(v("coins"), v("cost"))));
  B.script(whenFlag(), [set("cool", 0), costume("right"), d.setEffect("GHOST", 0), front(), d.say(""), d.forever([
    goto(screenX(d, v("mcol")), screenY(d, v("mrow"))),
    // Just hurt: blink.
    ifElse(gt(v("safe"), 0), [ifElse(lt(d.mod(v("safe"), 6), 3), [d.setEffect("GHOST", 70)], [d.setEffect("GHOST", 0)])], [d.setEffect("GHOST", 0)]),
    ifThen(eq(v("phase"), "over"), [d.say("Game over! Click the green flag.")]),
    ifThen(eq(v("phase"), "play"), [
      ifElse(canUpgrade(), [d.say(d.join("Press U: better pickaxe for ", d.join(v("cost"), " coins!")))], [d.say("")]),
      ifThen(and(key("u"), canUpgrade()), [call("upgrade")]),
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

// ---------------------------------------------------------------- Crawler: walks to and fro in its cave
function crawlerScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "row", "x", "speed");
  const d = dsl(B);
  const { v, eq, gt, set, change, ifThen, whenFlag, whenReceive, whenCloned, cloneMyself, deleteClone, hide, show, goto,
    forever, touching, costume, broadcast } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
  B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);
  // The Square sprite made a cave: put a crawler in it (the clone copies my row and x).
  B.script(whenReceive("crawler"), [ifThen(eq(v("isClone"), 0), [
    set("row", v("crawlRow")), set("x", screenX(d, v("crawlCol"))), cloneMyself()])], 20, 180);
  B.script(whenCloned(), [
    set("isClone", 1), set("speed", 1), show(),
    forever([
      ifThen(gt(screenY(d, v("row")), 200), [deleteClone()]),
      change("x", v("speed")), goto(v("x"), screenY(d, v("row"))),
      // Bumped into a square? Step back and turn around.
      ifThen(touching("Square"), [
        change("x", d.mul(v("speed"), -1)), set("speed", d.mul(v("speed"), -1)),
        ifThen(gt(v("speed"), 0), [costume("right")]), ifThen(gt(0, v("speed")), [costume("left")]),
      ]),
      ifThen(touching("Miner"), [broadcast("ouch")]),
    ]),
  ], 20, 280);
  return B;
}

// ---------------------------------------------------------------- Hud: the pickaxe you have, top right
function hudScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(214, 154), d.show(), d.forever([d.costumeTo(d.v("pickLevel")), d.front()])], 20, 20);
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
    P.sprite("Crawler", { blocks: crawlerScripts(), costumes: A.crawler, layer: 5, visible: false }),
    P.sprite("Hud", { blocks: hudScripts(), costumes: A.pickaxes, layer: 6, x: 214, y: 154 }),
    P.sprite("Lantern", { blocks: lanternScripts(), costumes: A.lantern, layer: 4, x: LEFT + START_COL * CELL, y: ROW0 }),
  ],
  shown: ["coins", "depth", "hearts"],
});
writeFileSync(new URL("lantern-deep.sb3", import.meta.url), sb3);
console.log(`lantern-deep.sb3: ${sb3.length} bytes`);
