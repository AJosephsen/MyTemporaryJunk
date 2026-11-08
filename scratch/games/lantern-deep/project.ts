// Lantern Deep, as a function of the tutorial step: lanternDeep(7) is the whole game, lanternDeep(1..6) are the
// tutorial's checkpoints, lanternDeep(0) is the starter (artwork, no code). Each step adds one idea:
//   1  rows of squares: the Square sprite sets its own variables, then clones itself (clones copy them)
//   2  digging: an invisible Pick goes to the square the miner faces; the square touching it takes the hit
//   3  scrolling: screen y = row maths + scroll; new rows below, old rows above are removed
//   4  in the dark: squares show what they are only when the Lantern touches them; treasure by depth, coins
//   5  better pickaxes: U buys an upgrade that hits twice as hard
//   6  lava and hearts
//   7  cave crawlers
//
// No lists. Squares are clones of the Square sprite; each clone keeps its own row, col, kind, hp and value.
// Rows are numbered from the top (row 0) down. The Stage broadcasts `tick` every frame.
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { art, CELL, COLS, LEFT, KINDS, KIND } from "./art.ts";

export const LAST = 7;
const ROW0 = 124;            // screen y of row 0 when scroll is 0
const AHEAD = 9;             // rows made below the miner
const MINER_ROW_ON_SCREEN = 3;
const START_COL = 7;

export function lanternDeep(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);
  type D = ReturnType<typeof dsl>;
  const screenX = (d: D, col: In) => d.add(LEFT, d.mul(col, CELL));
  // From step 3 the whole mine moves up by `scroll`.
  const screenY = (d: D, row: In) => at(3) ? d.add(d.sub(ROW0, d.mul(row, CELL)), d.v("scroll")) : d.sub(ROW0, d.mul(row, CELL));

  // ---------------------------------------------------------------- Stage: start, scrolling, hearts
  function stageScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, sub, mul, gt, set, change, ifThen, whenFlag, forever, broadcast, broadcastWait } = d;
    if (!at(1)) return B;
    B.script(whenFlag(), [
      ...when(4, () => [set("coins", 0)]),
      ...when(5, () => [set("power", 1), set("pickLevel", 1), set("pickaxe", "wood"), set("cost", 40)]),
      ...when(6, () => [set("hearts", 3), set("safe", 0), set("phase", "play")]),
      set("mrow", 0), set("mcol", START_COL), ...when(3, () => [set("scroll", 0), set("depth", 0)]),
      set("lastRow", -1),
      broadcastWait("clear"),
      forever([
        // The view follows the miner down, smoothly: the miner stays near the top of the screen.
        ...when(3, () => [
          set("target", mul(sub(v("mrow"), MINER_ROW_ON_SCREEN), CELL)),
          ifThen(gt(0, v("target")), [set("target", 0)]),
          change("scroll", d.div(sub(v("target"), v("scroll")), 4)),
          set("depth", v("mrow")),
        ]),
        ...when(6, () => [ifThen(gt(v("safe"), 0), [change("safe", -1)])]),
        broadcast("tick"),
      ]),
    ], 20, 20);
    // Hurt by lava or a crawler: lose a heart, then a short safe time.
    if (at(6)) B.script(d.whenReceive("ouch"), [
      ifThen(d.and(d.eq(v("phase"), "play"), d.eq(v("safe"), 0)), [
        change("hearts", -1), set("safe", 45),
        ifThen(d.lt(v("hearts"), 1), [set("phase", "over")]),
      ]),
    ], 20, 520);
    return B;
  }

  // ---------------------------------------------------------------- Square: made row by row, lit by the lantern, dug by the pick
  function squareScripts(): Blocks {
    const B = new Blocks(P).local("isClone", "row", "col", "kind", "hp", ...(at(4) ? ["value", "lit"] : []));
    const d = dsl(B);
    const { v, add, sub, eq, gt, lt, and, or, not, set, change, repeat, ifThen, ifElse, until, whenFlag, whenReceive,
      whenCloned, cloneMyself, deleteClone, hide, show, goto, costumeTo, costume, touching, random, define, call } = d;
    const kind = (name: keyof typeof KIND) => {
      const k = KINDS[KIND[name] - 1];
      return [set("kind", KIND[name]), set("hp", k.hp), ...when(4, () => [set("value", k.value)])];
    };
    if (!at(1)) return B;
    B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
    B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);

    // The Square sprite itself keeps making rows until there are enough below the miner.
    B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 0), [call("make rows")])], 20, 180);
    const inCave = () => and(eq(v("cave"), 1), and(gt(v("col"), sub(v("caveFrom"), 1)), lt(v("col"), add(v("caveFrom"), 5))));
    define("make rows", [
      until(not(lt(v("lastRow"), add(v("mrow"), AHEAD))), [
        change("lastRow", 1), set("row", v("lastRow")), set("col", 0),
        // Deeper than row 20, some rows have a small cave: 5 empty squares with a crawler inside.
        ...when(7, () => [set("cave", 0),
          ifThen(and(gt(v("row"), 20), lt(random(1, 100), 9)), [set("cave", 1), set("caveFrom", random(2, 8))])]),
        repeat(COLS, [
          ...(at(4) ? [call("choose kind")] : kind("dirt")),
          // Edges are bedrock; the miner's start square stays empty.
          ifThen(or(eq(v("col"), 0), eq(v("col"), COLS - 1)), kind("bedrock")),
          ifThen(not(at(7) ? or(and(eq(v("row"), 0), eq(v("col"), START_COL)), inCave())
            : and(eq(v("row"), 0), eq(v("col"), START_COL))), [cloneMyself()]),
          change("col", 1),
        ]),
        ...when(7, () => [ifThen(eq(v("cave"), 1),
          [set("crawlRow", v("row")), set("crawlCol", add(v("caveFrom"), 2)), d.broadcast("crawler")])]),
      ]),
    ], { warp: true, x: 420, y: 20 });
    // What is in this square? Deeper rows have more stone and better treasure.
    if (at(4)) define("choose kind", [
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
      ...when(6, () => [ifThen(and(gt(v("row"), 15), and(gt(v("dice"), 960), lt(v("dice"), add(944, v("row"))))), kind("lava"))]),
    ], { warp: true, x: 420, y: 400 });

    B.script(whenCloned(), at(4) ? [set("isClone", 1), set("lit", 0), costume("dark"), show()]
      : [set("isClone", 1), costumeTo(add(v("kind"), 1)), show()], 20, 280);
    // Every frame: move with the scroll, go when far above the screen, and light up when the lantern reaches me.
    B.script(whenReceive("tick"), [
      ifThen(eq(v("isClone"), 1), [
        // Far above the screen? Then I'm not needed any more. (Use the sum, not y position: Scratch keeps sprites
        // on the Stage, so y position never gets that high.)
        ...when(3, () => [ifThen(gt(screenY(d, v("row")), 200), [deleteClone()])]),
        goto(screenX(d, v("col")), screenY(d, v("row"))),
        ...when(4, () => [ifThen(and(eq(v("lit"), 0), touching("Lantern")), [set("lit", 1), costumeTo(add(v("kind"), 1))])]),
      ]),
    ], 20, 360);
    // Hit by the pick: lose strength; when none is left, give my treasure and go.
    if (at(2)) {
      const damage = [
        change("hp", at(5) ? d.mul(v("power"), -1) : -1),
        ifThen(lt(v("hp"), 1), [...when(4, () => [change("coins", v("value"))]), deleteClone()]),
      ];
      B.script(whenReceive("dig"), [
        ifThen(and(eq(v("isClone"), 1), touching("Pick")), [
          set("hit", 1),
          ...(at(6) ? [ifElse(eq(v("kind"), KIND.lava), [d.broadcast("ouch")], damage)] : damage),
        ]),
      ], 20, 520);
    }
    return B;
  }

  // ---------------------------------------------------------------- Miner: the arrow keys dig, and walk into empty squares
  function minerScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, add, eq, gt, lt, and, not, set, change, ifThen, ifElse, key, goto, costume, whenFlag,
      broadcastWait, front, define, call } = d;
    if (!at(1)) return B;
    // The Miner has its own loop, not a `tick` script: `broadcast and wait` takes a frame, and the next `tick`
    // would restart a tick script in the middle of it.
    if (at(2)) define("try %s %s", [
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
    if (at(5)) define("upgrade", [
      change("coins", d.mul(v("cost"), -1)), change("pickLevel", 1), set("power", d.mul(v("power"), 2)),
      pick(2, "stone", 150), pick(3, "iron", 500), pick(4, "diamond", 0),
      d.say("New pickaxe!"), d.waitUntil(not(key("u"))),
    ], { x: 420, y: 300 });
    const canUpgrade = () => and(lt(v("pickLevel"), 4), not(lt(v("coins"), v("cost"))));
    const digging = () => [
      ...when(5, () => [
        ifElse(canUpgrade(), [d.say(d.join("Press U: better pickaxe for ", d.join(v("cost"), " coins!")))], [d.say("")]),
        ifThen(and(key("u"), canUpgrade()), [call("upgrade")]),
      ]),
      ifElse(gt(v("cool"), 0), [change("cool", -1)], [
        ifElse(key("right arrow"), [costume("right"), call("try %s %s", 1, 0)], [
          ifElse(key("left arrow"), [costume("left"), call("try %s %s", -1, 0)], [
            ifElse(key("down arrow"), [call("try %s %s", 0, 1)], [
              ifThen(key("up arrow"), [call("try %s %s", 0, -1)]),
            ]),
          ]),
        ]),
      ]),
    ];
    B.script(whenFlag(), [
      ...when(2, () => [set("cool", 0)]), costume("right"), ...when(6, () => [d.setEffect("GHOST", 0)]), front(),
      ...when(5, () => [d.say("")]),
      d.forever([
        goto(screenX(d, v("mcol")), screenY(d, v("mrow"))),
        ...when(6, () => [
          // Just hurt: blink.
          ifElse(gt(v("safe"), 0), [ifElse(lt(d.mod(v("safe"), 6), 3), [d.setEffect("GHOST", 70)], [d.setEffect("GHOST", 0)])],
            [d.setEffect("GHOST", 0)]),
          ifThen(eq(v("phase"), "over"), [d.say("Game over! Click the green flag.")]),
        ]),
        ...(at(6) ? [ifThen(eq(v("phase"), "play"), digging())] : at(2) ? digging() : []),
      ]),
    ], 20, 120);
    return B;
  }

  // ---------------------------------------------------------------- Lantern, Pick and Hud
  function lanternScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    if (at(4)) B.script(d.whenFlag(), [d.show()], 20, 20);
    if (at(4)) B.script(d.whenReceive("tick"), [d.goto(screenX(d, d.v("mcol")), screenY(d, d.v("mrow"))), d.front()], 20, 100);
    return B;
  }
  function pickScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    if (!at(2)) return B;
    B.script(d.whenFlag(), [d.setEffect("GHOST", 100), d.show()], 20, 20);
    B.script(d.whenReceive("aim"), [
      d.goto(screenX(d, d.add(d.v("mcol"), d.v("dx"))), screenY(d, d.add(d.v("mrow"), d.v("dy")))),
    ], 20, 120);
    return B;
  }
  function hudScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    if (at(5)) B.script(d.whenFlag(), [d.goto(214, 154), d.show(), d.forever([d.costumeTo(d.v("pickLevel")), d.front()])], 20, 20);
    return B;
  }

  // ---------------------------------------------------------------- Crawler: walks to and fro in its cave
  function crawlerScripts(): Blocks {
    const B = new Blocks(P).local(...(at(7) ? ["isClone", "row", "x", "speed"] : []));
    const d = dsl(B);
    const { v, eq, gt, set, change, ifThen, whenFlag, whenReceive, whenCloned, cloneMyself, deleteClone, hide, show, goto,
      forever, touching, costume, broadcast } = d;
    if (!at(7)) return B;
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

  const A = art(P);
  return P.build({
    backdrop: A.backdrop,
    stage: stageScripts(),
    sprites: [
      P.sprite("Square", { blocks: squareScripts(), costumes: A.squares, layer: 1, visible: false }),
      P.sprite("Pick", { blocks: pickScripts(), costumes: A.pick, layer: 2, visible: false }),
      P.sprite("Miner", { blocks: minerScripts(), costumes: A.miner, layer: 3, x: LEFT + START_COL * CELL, y: ROW0 }),
      P.sprite("Crawler", { blocks: crawlerScripts(), costumes: A.crawler, layer: 5, visible: false }),
      P.sprite("Hud", { blocks: hudScripts(), costumes: A.pickaxes, layer: 6, x: 214, y: 154, visible: false }),
      P.sprite("Lantern", { blocks: lanternScripts(), costumes: A.lantern, layer: 4, x: LEFT + START_COL * CELL, y: ROW0,
        visible: false }),
    ],
    shown: [...(at(4) ? ["coins"] : []), ...(at(3) ? ["depth"] : []), ...(at(6) ? ["hearts"] : [])],
  });
}
