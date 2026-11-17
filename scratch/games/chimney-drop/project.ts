// Chimney Drop, as a function of the tutorial step: chimneyDrop(6) is the whole game, 1..5 are the tutorial's
// checkpoints, 0 is the starter (artwork, no code). Standard Scratch only: every sprite runs its own scripts with
// green flag, forever, key presses, broadcasts, clones and "touching". No custom blocks, no lists.
//   1  the sleigh: the arrow keys move it left and right
//   2  houses: the House sprite makes a clone of itself and one of the Chimney at the right edge; they move left
//      together
//   3  presents: Space makes a Present clone at the sleigh; it falls
//   4  delivered: a present that touches a Chimney scores, and the chimney glows
//   5  misses: a present that hits a roof or the snow is lost; when the sack is empty, Santa says goodbye
//   6  snow and speed: falling snow, and the houses come faster as the score grows
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art } from "./art.ts";

export const LAST = 6;
export const SLEIGH_Y = 125, HOUSE_Y = -94, START_X = 280, END_X = -270, FALL = 5, SPEED = 2, SACK = 5;

export function chimneyDrop(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Sleigh: arrow keys; Space drops a present
  function sleighScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, eq, lt, gt, add, div, set, ifThen, whenFlag, forever, goto, changeX, setX, xPos, key, cloneOf, wait, stopAll, join } = d;
    if (!at(1)) return B;
    // The sleigh also sets up the game, before its loop (so nothing reads an old value).
    B.script(whenFlag(), [
      goto(0, SLEIGH_Y),
      ...when(4, () => [set("score", 0)]),
      ...when(5, () => [set("presents", SACK)]),
      ...when(6, () => [set("speed", SPEED)]),
      forever([
        ifThen(key("left arrow"), [changeX(-5)]),
        ifThen(key("right arrow"), [changeX(5)]),
        // Not off the screen.
        ifThen(lt(xPos(), -180), [setX(-180)]),
        ifThen(gt(xPos(), 180), [setX(180)]),
        // The more presents delivered, the faster the houses come.
        ...when(6, () => [set("speed", add(SPEED, div(v("score"), 5)))]),
        // An empty sack: the end. Say it first: "stop all" also clears speech bubbles.
        ...when(5, () => [ifThen(eq(v("presents"), 0), [d.sayFor(join("Merry Christmas! Presents delivered: ", v("score")), 3), stopAll()])]),
      ]),
    ], 20, 20);
    if (at(3)) B.script(d.whenKey("space"), [
      // One present, then a short pause before the next.
      cloneOf("Present"), wait(0.4),
    ], 20, 520);
    return B;
  }

  // ---------------------------------------------------------------- House and Chimney: clones that move left together
  // The House sprite waits, hidden, at the right edge and makes the clones: one of itself and one of the Chimney. A
  // Chimney clone starts with "go to House", so it sits on the new house; then both move left at the same speed.
  // (Not a broadcast: a broadcast reaches the clones too, and each of them would make more clones.)
  function scrollerScripts(name: "House" | "Chimney"): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, lt, mul, whenFlag, whenCloned, hide, show, goto, goTo, forever, wait, random, cloneMyself, cloneOf, until, changeX,
      xPos, deleteClone, costumeTo, ifThen, touching, costume } = d;
    if (!at(2)) return B;
    if (name === "House") B.script(whenFlag(), [hide(), goto(START_X, HOUSE_Y),
      forever([wait(random(2, 4)), costumeTo(random(1, 3)), cloneMyself(), cloneOf("Chimney")])], 20, 20);
    else B.script(whenFlag(), [hide()], 20, 20);
    B.script(whenCloned(), [
      ...(name === "Chimney" ? [goTo("House"), costume("chimney")] : []),
      show(),
      until(lt(xPos(), END_X), [
        changeX(at(6) ? mul(v("speed"), -1) : -SPEED),
        // A present went down this chimney: it glows.
        ...(name === "Chimney" && at(4) ? [ifThen(touching("Present"), [costume("glow")])] : []),
      ]),
      deleteClone(),
    ], 20, 240);
    return B;
  }

  // ---------------------------------------------------------------- Present: falls from the sleigh
  function presentScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { lt, or, change, ifThen, whenFlag, whenCloned, hide, show, goTo, until, changeY, yPos, deleteClone, costumeTo,
      random, touching, wait } = d;
    if (!at(3)) return B;
    B.script(whenFlag(), [hide()], 20, 20);
    const landed = lt(yPos(), -130);
    B.script(whenCloned(), [
      goTo("Sleigh"), costumeTo(random(1, 3)), show(),
      // Fall until it lands (from step 4 also until it meets a chimney or a roof).
      until(at(4) ? or(or(touching("Chimney"), touching("House")), landed) : landed, [changeY(-FALL)]),
      ...when(4, () => [
        ifThen(touching("Chimney"), [change("score", 1), wait(0.05)]),     // stay a moment, so the chimney notices
      ]),
      ...when(5, () => [
        // On a roof or in the snow: lost.
        ifThen(d.not(touching("Chimney")), [change("presents", -1)]),
      ]),
      deleteClone(),
    ], 20, 120);
    return B;
  }

  // ---------------------------------------------------------------- Snow: lots of little clones
  function snowScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { lt, whenFlag, whenCloned, hide, show, goto, forever, cloneMyself, wait, random, until, changeY, changeX, yPos,
      deleteClone, setEffect, setSize } = d;
    if (!at(6)) return B;
    B.script(whenFlag(), [hide(), forever([cloneMyself(), wait(0.1)])], 20, 20);
    B.script(whenCloned(), [
      goto(random(-240, 240), 180), setSize(random(50, 120)), setEffect("GHOST", random(0, 50)), show(),
      until(lt(yPos(), -170), [changeY(-1.5), changeX(random(-1, 1))]),
      deleteClone(),
    ], 20, 160);
    return B;
  }

  const A = art(P);
  return P.build({
    backdrop: A.backdrop,
    sprites: [
      P.sprite("Snow", { blocks: snowScripts(), costumes: A.flake, layer: 1, visible: false }),
      P.sprite("House", { blocks: scrollerScripts("House"), costumes: A.house, layer: 2, visible: false }),
      P.sprite("Chimney", { blocks: scrollerScripts("Chimney"), costumes: A.chimney, layer: 3, visible: false }),
      P.sprite("Present", { blocks: presentScripts(), costumes: A.present, layer: 4, visible: false }),
      P.sprite("Sleigh", { blocks: sleighScripts(), costumes: A.sleigh, layer: 5, x: 0, y: SLEIGH_Y }),
    ],
    shown: [...(at(4) ? ["score"] : []), ...(at(5) ? ["presents"] : [])],
  });
}
