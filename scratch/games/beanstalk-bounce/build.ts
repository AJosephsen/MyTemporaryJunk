// Builds beanstalk-bounce.sb3: an original endless jumper. A frog bounces up a giant beanstalk from leaf to leaf.
//
// Levels are made from numbers ("parametric"): the Leaf sprite keeps placing leaves above the last one, with a gap
// between `minGap` and `maxGap`. Both grow with the height, so the climb gets harder; the frog can always reach the
// next leaf, because the biggest gap stays below his jump height (JUMP * JUMP / (2 * GRAVITY) = 121 pixels).
//
// No lists. Every leaf is a clone that keeps its own height `wy` (world y). The camera follows the frog up:
// screen y = world y - camera.
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art, LEAF_GREEN, DRY_BROWN, CAP_RED } from "./art.ts";

const P = new Project();
const GRAVITY = 0.5, JUMP = 11, SUPER_JUMP = 20, STEER = 5;
const START_Y = -150;        // the first leaf, right under the frog

// ---------------------------------------------------------------- Stage: start, the clock, the level numbers
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, div, gt, set, ifThen, whenFlag, forever, broadcast, broadcastWait } = d;
  B.script(whenFlag(), [
    set("camera", 0), set("height", 0), set("nextY", START_Y), set("phase", "play"),
    broadcastWait("clear"),
    forever([
      // The level numbers: the higher you are, the bigger the gaps between leaves.
      set("minGap", add(30, div(v("camera"), 100))), ifThen(gt(v("minGap"), 80), [set("minGap", 80)]),
      set("maxGap", add(55, div(v("camera"), 40))), ifThen(gt(v("maxGap"), 105), [set("maxGap", 105)]),
      // Chances in percent for each new leaf: moving leaves from height 30, dry leaves from 60, bees from 150.
      set("moveChance", d.sub(div(v("height"), 5), 6)), ifThen(gt(v("moveChance"), 40), [set("moveChance", 40)]),
      set("dryChance", d.sub(div(v("height"), 8), 7)), ifThen(gt(v("dryChance"), 25), [set("dryChance", 25)]),
      set("beeChance", d.sub(div(v("height"), 20), 7)), ifThen(gt(v("beeChance"), 12), [set("beeChance", 12)]),
      broadcast("tick"),
    ]),
  ], 20, 20);
  return B;
}

// ---------------------------------------------------------------- Leaf: placed above the last one, removed below the screen
function leafScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "wy", "dx", "crumble");
  const d = dsl(B);
  const touching = d.touching;
  const { v, add, sub, eq, gt, lt, and, or, not, set, change, ifThen, ifElse, until, whenFlag, whenReceive, whenCloned,
    cloneMyself, deleteClone, hide, show, goto, setY, random, define, call } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
  B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 0), [call("grow")])], 20, 180);
  // Keep placing leaves until there is one just above the top of the screen.
  define("grow", [
    until(gt(v("nextY"), add(v("camera"), 220)), [
      set("wy", v("nextY")),
      // The first leaf is right under the frog; the others go anywhere across the screen.
      ifElse(eq(v("nextY"), START_Y), [goto(0, sub(v("wy"), v("camera")))], [goto(random(-200, 200), sub(v("wy"), v("camera")))]),
      // What kind of leaf? The chances come from the Stage's level numbers.
      d.costume("leaf"), set("dx", 0),
      ifThen(gt(v("nextY"), START_Y), [
        ifThen(lt(random(1, 100), v("moveChance")), [set("dx", d.mul(2, d.sub(d.mul(random(0, 1), 2), 1)))]),
        ifThen(lt(random(1, 100), 7), [d.costume("mushroom"), set("dx", 0)]),
        ifThen(lt(random(1, 100), v("dryChance")), [d.costume("dry"), set("dx", 0)]),
      ]),
      cloneMyself(),
      // Sometimes a bee, between this leaf and the next.
      ifThen(lt(random(1, 100), v("beeChance")), [set("beeY", add(v("nextY"), 40)), d.broadcast("bee")]),
      change("nextY", random(v("minGap"), v("maxGap"))),
    ]),
  ], { warp: true, x: 420, y: 20 });
  B.script(whenCloned(), [set("isClone", 1), set("crumble", 0), show()], 20, 280);
  B.script(whenReceive("tick"), [
    ifThen(eq(v("isClone"), 1), [
      // Below the screen? Then it's gone for good.
      ifThen(lt(sub(v("wy"), v("camera")), -200), [deleteClone()]),
      setY(sub(v("wy"), v("camera"))),
      // Moving leaves go to and fro.
      ifThen(not(eq(v("dx"), 0)), [d.changeX(v("dx")), ifThen(or(gt(d.xPos(), 200), lt(d.xPos(), -200)), [set("dx", d.mul(v("dx"), -1))])]),
      // A dry leaf crumbles when the frog lands on it: it falls and fades.
      ifThen(and(eq(d.costumeNumber(), 2), and(touching("Frog"), lt(v("vy"), 0))), [set("crumble", 1)]),
      ifThen(eq(v("crumble"), 1), [change("wy", -8), d.changeEffect("GHOST", 12)]),
    ]),
  ], 20, 360);
  return B;
}

// ---------------------------------------------------------------- Frog: steer, fall, bounce
function frogScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, sub, gt, lt, set, change, ifThen, ifElse, key, goto, costume, whenFlag, forever, say, front, round, div } = d;
  B.script(whenFlag(), [
    set("fx", 0), set("fy", START_Y + 30), set("vy", 0), say(""), front(), d.point(90),
    forever([
      // Stung by a bee: no more bouncing, just falling.
      ifThen(d.eq(v("phase"), "stung"), [
        change("vy", -GRAVITY), change("fy", v("vy")), goto(v("fx"), sub(v("fy"), v("camera"))), d.turn(12),
        ifThen(lt(sub(v("fy"), v("camera")), -190), [set("phase", "over"), d.point(90), say("Bzzz! Click the green flag.")]),
      ]),
      ifThen(d.eq(v("phase"), "play"), [
        ifThen(key("right arrow"), [change("fx", STEER)]),
        ifThen(key("left arrow"), [change("fx", -STEER)]),
        // Off one side, back on the other.
        ifThen(gt(v("fx"), 240), [change("fx", -480)]),
        ifThen(lt(v("fx"), -240), [change("fx", 480)]),
        change("vy", -GRAVITY), change("fy", v("vy")),
        goto(v("fx"), sub(v("fy"), v("camera"))),
        // Falling onto a green leaf? Bounce! A red mushroom cap bounces much higher. (Dry brown leaves don't hold.)
        ifThen(lt(v("vy"), 0), [
          ifThen(d.touchingColor(LEAF_GREEN), [set("vy", JUMP)]),
          ifThen(d.touchingColor(CAP_RED), [set("vy", SUPER_JUMP)]),
        ]),
        ifElse(gt(v("vy"), 0), [costume("jump")], [costume("sit")]),
        // The camera follows the frog up, never down.
        ifThen(gt(sub(v("fy"), v("camera")), 30), [set("camera", sub(v("fy"), 30))]),
        set("height", round(div(v("camera"), 10))),
        ifThen(gt(v("height"), v("best")), [set("best", v("height"))]),
        // Fell off the bottom of the screen: game over.
        ifThen(lt(sub(v("fy"), v("camera")), -190), [set("phase", "over"), say("Oh no! Click the green flag.")]),
      ]),
    ]),
  ], 20, 20);
  B.script(d.whenReceive("stung"), [ifThen(d.eq(v("phase"), "play"), [set("phase", "stung"), say("Ouch!"), set("vy", 0)])], 20, 700);
  return B;
}

// ---------------------------------------------------------------- Bee: flies across between two leaves
function beeScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "wy", "dx");
  const d = dsl(B);
  const { v, sub, eq, gt, lt, or, set, ifThen, whenFlag, whenReceive, whenCloned, cloneMyself, deleteClone, hide, show,
    goto, setY, changeX, xPos, touching, costume, broadcast, random } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
  B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);
  // The Leaf sprite asked for a bee at height beeY (the clone copies my wy and dx).
  B.script(whenReceive("bee"), [ifThen(eq(v("isClone"), 0), [
    set("wy", v("beeY")), set("dx", 3), goto(random(-200, 200), sub(v("wy"), v("camera"))), cloneMyself()])], 20, 180);
  B.script(whenCloned(), [set("isClone", 1), show()], 20, 280);
  B.script(whenReceive("tick"), [
    ifThen(eq(v("isClone"), 1), [
      ifThen(lt(sub(v("wy"), v("camera")), -200), [deleteClone()]),
      setY(sub(v("wy"), v("camera"))), changeX(v("dx")),
      ifThen(or(gt(xPos(), 215), lt(xPos(), -215)), [set("dx", d.mul(v("dx"), -1))]),
      ifThen(gt(v("dx"), 0), [costume("right")]), ifThen(lt(v("dx"), 0), [costume("left")]),
      ifThen(touching("Frog"), [broadcast("stung")]),
    ]),
  ], 20, 360);
  return B;
}

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Leaf", { blocks: leafScripts(), costumes: A.leaf, layer: 1, visible: false }),
    P.sprite("Bee", { blocks: beeScripts(), costumes: A.bee, layer: 2, visible: false }),
    P.sprite("Frog", { blocks: frogScripts(), costumes: A.frog, layer: 3, y: START_Y + 30 }),
  ],
  shown: ["height", "best"],
});
writeFileSync(new URL("beanstalk-bounce.sb3", import.meta.url), sb3);
console.log(`beanstalk-bounce.sb3: ${sb3.length} bytes`);
