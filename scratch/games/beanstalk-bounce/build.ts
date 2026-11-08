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
import { art } from "./art.ts";

const P = new Project();
const GRAVITY = 0.5, JUMP = 11, STEER = 5;
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
      broadcast("tick"),
    ]),
  ], 20, 20);
  return B;
}

// ---------------------------------------------------------------- Leaf: placed above the last one, removed below the screen
function leafScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "wy");
  const d = dsl(B);
  const { v, add, sub, eq, gt, lt, not, set, change, ifThen, ifElse, until, whenFlag, whenReceive, whenCloned,
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
      cloneMyself(),
      change("nextY", random(v("minGap"), v("maxGap"))),
    ]),
  ], { warp: true, x: 420, y: 20 });
  B.script(whenCloned(), [set("isClone", 1), show()], 20, 280);
  B.script(whenReceive("tick"), [
    ifThen(eq(v("isClone"), 1), [
      // Below the screen? Then it's gone for good.
      ifThen(lt(sub(v("wy"), v("camera")), -200), [deleteClone()]),
      setY(sub(v("wy"), v("camera"))),
    ]),
  ], 20, 360);
  void not; void lt;
  return B;
}

// ---------------------------------------------------------------- Frog: steer, fall, bounce
function frogScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, sub, gt, lt, and, set, change, ifThen, ifElse, key, goto, costume, whenFlag, forever, touching, say, front, round, div } = d;
  B.script(whenFlag(), [
    set("fx", 0), set("fy", START_Y + 30), set("vy", 0), say(""), front(),
    forever([
      ifThen(d.eq(v("phase"), "play"), [
        ifThen(key("right arrow"), [change("fx", STEER)]),
        ifThen(key("left arrow"), [change("fx", -STEER)]),
        // Off one side, back on the other.
        ifThen(gt(v("fx"), 240), [change("fx", -480)]),
        ifThen(lt(v("fx"), -240), [change("fx", 480)]),
        change("vy", -GRAVITY), change("fy", v("vy")),
        goto(v("fx"), sub(v("fy"), v("camera"))),
        // Falling onto a leaf? Bounce!
        ifThen(and(lt(v("vy"), 0), touching("Leaf")), [set("vy", JUMP)]),
        ifElse(gt(v("vy"), 0), [costume("jump")], [costume("sit")]),
        // The camera follows the frog up, never down.
        ifThen(gt(sub(v("fy"), v("camera")), 30), [set("camera", sub(v("fy"), 30))]),
        set("height", round(div(v("camera"), 10))),
        // Fell off the bottom of the screen: game over.
        ifThen(lt(sub(v("fy"), v("camera")), -190), [set("phase", "over"), say("Oh no! Click the green flag.")]),
      ]),
    ]),
  ], 20, 20);
  return B;
}

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Leaf", { blocks: leafScripts(), costumes: A.leaf, layer: 1, visible: false }),
    P.sprite("Frog", { blocks: frogScripts(), costumes: A.frog, layer: 2, y: START_Y + 30 }),
  ],
  shown: ["height"],
});
writeFileSync(new URL("beanstalk-bounce.sb3", import.meta.url), sb3);
console.log(`beanstalk-bounce.sb3: ${sb3.length} bytes`);
