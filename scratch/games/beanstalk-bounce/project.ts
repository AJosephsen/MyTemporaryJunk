// Beanstalk Bounce, as a function of the tutorial step: beanstalkBounce(5) is the whole game, 1..4 are the tutorial's
// checkpoints, 0 is the starter (artwork, no code). Each step adds one idea:
//   1  gravity and bounce: vy shrinks every frame (gravity); a leaf that the frog lands on sets it back to the jump
//      speed. Two sprites: Frog is only the invisible feet (what the leaves touch), Skin is what you see.
//   2  climb forever: a camera follows the frog up; leaves keep their height, screen y = height - camera
//   3  level numbers: the gaps between leaves grow with the height (parametric levels); best height
//   4  leaf kinds: moving, mushrooms and dry leaves, chosen by chances; each leaf knows its own kind (costume)
//   5  bees
//
// No lists. Every leaf is a clone that keeps its own height `wy` (world y).
// The frog can always reach the next leaf: the biggest gap stays below JUMP * JUMP / (2 * GRAVITY) = 121 pixels.
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { art } from "./art.ts";

export const LAST = 5;
const GRAVITY = 0.5, JUMP = 11, SUPER_JUMP = 20, STEER = 5;
const START_Y = -150;        // the first leaf, right under the frog

export function beanstalkBounce(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);
  type D = ReturnType<typeof dsl>;
  // Where something at height h is on the screen. From step 2 the camera moves up.
  const screen = (d: D, h: In) => at(2) ? d.sub(h, d.v("camera")) : h;

  // ---------------------------------------------------------------- Stage: start, the clock, the level numbers
  function stageScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, add, sub, div, gt, set, ifThen, whenFlag, forever, broadcast, broadcastWait } = d;
    if (!at(1)) return B;
    const capped = (name: string, value: In, max: number) => [set(name, value), ifThen(gt(v(name), max), [set(name, max)])];
    B.script(whenFlag(), [
      ...when(2, () => [set("camera", 0), set("height", 0)]), set("nextY", START_Y), set("phase", "play"),
      broadcastWait("clear"),
      forever([
        // The level numbers: the higher you are, the bigger the gaps between leaves.
        ...when(3, () => [...capped("minGap", add(30, div(v("camera"), 100)), 80), ...capped("maxGap", add(55, div(v("camera"), 40)), 105)]),
        // Chances in percent for each new leaf: moving leaves from height 30, dry leaves from 60, bees from 150.
        ...when(4, () => [...capped("moveChance", sub(div(v("height"), 5), 6), 40), ...capped("dryChance", sub(div(v("height"), 8), 7), 25)]),
        ...when(5, () => capped("beeChance", sub(div(v("height"), 20), 7), 12)),
        broadcast("tick"),
      ]),
    ], 20, 20);
    return B;
  }

  // ---------------------------------------------------------------- Leaf: placed above the last one, removed below the screen
  function leafScripts(): Blocks {
    const B = new Blocks(P).local("isClone", "wy", ...(at(4) ? ["dx", "crumble"] : []));
    const d = dsl(B);
    const { v, add, eq, gt, lt, and, or, not, set, change, ifThen, ifElse, until, whenFlag, whenReceive, whenCloned,
      cloneMyself, deleteClone, hide, show, goto, setY, random, define, call, touching, costume } = d;
    if (!at(1)) return B;
    B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
    B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);
    B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 0), [call("grow")])], 20, 180);
    // Keep placing leaves until there is one just above the top of the screen.
    define("grow", [
      until(gt(v("nextY"), add(at(2) ? v("camera") : 0, 220)), [
        set("wy", v("nextY")),
        // The first leaf is right under the frog; the others go anywhere across the screen.
        ifElse(eq(v("nextY"), START_Y), [goto(0, screen(d, v("wy")))], [goto(random(-200, 200), screen(d, v("wy")))]),
        // What kind of leaf? The chances come from the Stage's level numbers.
        ...when(4, () => [costume("leaf"), set("dx", 0),
          ifThen(gt(v("nextY"), START_Y), [
            ifThen(lt(random(1, 100), v("moveChance")), [set("dx", d.mul(2, d.sub(d.mul(random(0, 1), 2), 1)))]),
            ifThen(lt(random(1, 100), 7), [costume("mushroom"), set("dx", 0)]),
            ifThen(lt(random(1, 100), v("dryChance")), [costume("dry"), set("dx", 0)]),
          ])]),
        cloneMyself(),
        // Sometimes a bee, between this leaf and the next.
        ...when(5, () => [ifThen(lt(random(1, 100), v("beeChance")), [set("beeY", add(v("nextY"), 40)), d.broadcast("bee")])]),
        change("nextY", at(3) ? random(v("minGap"), v("maxGap")) : random(40, 70)),
      ]),
    ], { warp: true, x: 420, y: 20 });
    B.script(whenCloned(), [set("isClone", 1), ...when(4, () => [set("crumble", 0)]), show()], 20, 280);
    // The frog's feet (the Frog sprite) landed on me while falling? Then I bounce him: a leaf back up to the jump speed,
    // a mushroom much higher. A dry leaf can't hold him: it crumbles, falls and fades.
    const landed = () => and(eq(v("phase"), "play"), and(lt(v("vy"), 0), touching("Frog")));
    const bounce = at(4)
      ? [ifThen(landed(), [
          ifThen(eq(d.costumeNumber(), 1), [set("vy", JUMP)]),
          ifThen(eq(d.costumeNumber(), 3), [set("vy", SUPER_JUMP)]),
          ifThen(eq(d.costumeNumber(), 2), [set("crumble", 1)]),
        ])]
      : [ifThen(landed(), [set("vy", JUMP)])];
    B.script(whenReceive("tick"), [
      ifThen(eq(v("isClone"), 1), [
        ...when(2, () => [
          // Below the screen? Then it's gone for good.
          ifThen(lt(screen(d, v("wy")), -200), [deleteClone()]),
          setY(screen(d, v("wy"))),
        ]),
        ...when(4, () => [
          // Moving leaves go to and fro.
          ifThen(not(eq(v("dx"), 0)), [d.changeX(v("dx")), ifThen(or(gt(d.xPos(), 200), lt(d.xPos(), -200)), [set("dx", d.mul(v("dx"), -1))])]),
        ]),
        ...bounce,
        ...when(4, () => [ifThen(eq(v("crumble"), 1), [change("wy", -8), d.changeEffect("GHOST", 12)])]),
      ]),
    ], 20, 360);
    return B;
  }

  // ---------------------------------------------------------------- Frog: steer, fall, bounce
  function frogScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, sub, gt, lt, set, change, ifThen, ifElse, key, goto, costume, whenFlag, forever, say, front, round, div } = d;
    if (!at(1)) return B;
    const fall = () => [change("vy", -GRAVITY), change("fy", v("vy")), goto(v("fx"), screen(d, v("fy")))];
    B.script(whenFlag(), [
      set("fx", 0), set("fy", START_Y + 30), set("vy", 0), ...when(2, () => [say("")]), ...when(5, () => [d.point(90)]),
      // The Frog is only the frog's invisible feet; the Skin sprite shows the frog. The leaves do the bouncing.
      d.setEffect("GHOST", 100),
      forever([
        // Stung by a bee: no more bouncing, just falling.
        ...when(5, () => [ifThen(d.eq(v("phase"), "stung"), [
          ...fall(),
          ifThen(lt(screen(d, v("fy")), -190), [set("phase", "over"), say("Bzzz! Click the green flag.")]),
        ])]),
        ifThen(d.eq(v("phase"), "play"), [
          ifThen(key("right arrow"), [change("fx", STEER)]),
          ifThen(key("left arrow"), [change("fx", -STEER)]),
          // Off one side, back on the other.
          ifThen(gt(v("fx"), 240), [change("fx", -480)]),
          ifThen(lt(v("fx"), -240), [change("fx", 480)]),
          // Gravity: the speed goes down a little every frame, and the frog moves by the speed.
          ...fall(),
          ...when(2, () => [
            // The camera follows the frog up, never down.
            ifThen(gt(screen(d, v("fy")), 30), [set("camera", sub(v("fy"), 30))]),
            set("height", round(div(v("camera"), 10))),
            ...when(3, () => [ifThen(gt(v("height"), v("best")), [set("best", v("height"))])]),
            // Fell off the bottom of the screen: game over.
            ifThen(lt(screen(d, v("fy")), -190), [set("phase", "over"), say("Oh no! Click the green flag.")]),
          ]),
        ]),
      ]),
    ], 20, 20);
    if (at(5)) B.script(d.whenReceive("stung"), [ifThen(d.eq(v("phase"), "play"), [set("phase", "stung"), say("Ouch!"), set("vy", 0)])], 20, 700);
    return B;
  }

  // ---------------------------------------------------------------- Skin: what the frog looks like, on top of the hit box
  function skinScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    if (!at(1)) return B;
    B.script(d.whenFlag(), [d.show(), d.point(90), d.forever([
      d.goTo("Frog"),
      d.ifElse(d.gt(d.v("vy"), 0), [d.costume("jump")], [d.costume("sit")]),
      ...when(5, () => [d.ifThen(d.eq(d.v("phase"), "stung"), [d.turn(12)])]),
      d.front(),
    ])], 20, 20);
    return B;
  }

  // ---------------------------------------------------------------- Bee: flies across between two leaves
  function beeScripts(): Blocks {
    const B = new Blocks(P).local(...(at(5) ? ["isClone", "wy", "dx"] : []));
    const d = dsl(B);
    const { v, eq, gt, lt, or, set, ifThen, whenFlag, whenReceive, whenCloned, cloneMyself, deleteClone, hide, show,
      goto, setY, changeX, xPos, touching, costume, broadcast, random } = d;
    if (!at(5)) return B;
    B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
    B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 100);
    // The Leaf sprite asked for a bee at height beeY (the clone copies my wy and dx).
    B.script(whenReceive("bee"), [ifThen(eq(v("isClone"), 0), [
      set("wy", v("beeY")), set("dx", 3), goto(random(-200, 200), screen(d, v("wy"))), cloneMyself()])], 20, 180);
    B.script(whenCloned(), [set("isClone", 1), show()], 20, 280);
    B.script(whenReceive("tick"), [
      ifThen(eq(v("isClone"), 1), [
        ifThen(lt(screen(d, v("wy")), -200), [deleteClone()]),
        setY(screen(d, v("wy"))), changeX(v("dx")),
        ifThen(or(gt(xPos(), 215), lt(xPos(), -215)), [set("dx", d.mul(v("dx"), -1))]),
        ifThen(gt(v("dx"), 0), [costume("right")]), ifThen(lt(v("dx"), 0), [costume("left")]),
        // The bee stings the frog you see: the Skin.
        ifThen(touching("Skin"), [broadcast("stung")]),
      ]),
    ], 20, 360);
    return B;
  }

  const A = art(P);
  return P.build({
    backdrop: A.backdrop,
    stage: stageScripts(),
    sprites: [
      P.sprite("Leaf", { blocks: leafScripts(), costumes: A.leaf, layer: 1, visible: false }),
      P.sprite("Bee", { blocks: beeScripts(), costumes: A.bee, layer: 2, visible: false }),
      P.sprite("Frog", { blocks: frogScripts(), costumes: A.feet, layer: 3, y: START_Y + 30 }),
      P.sprite("Skin", { blocks: skinScripts(), costumes: A.skin, layer: 4, y: START_Y + 30 }),
    ],
    shown: [...(at(2) ? ["height"] : []), ...(at(3) ? ["best"] : [])],
  });
}
