// Sky Guard, as a function of the tutorial step: skyGuard(4) is the whole game, 1..3 are the tutorial's checkpoints,
// 0 is the starter (artwork, no code). Basic blocks only: no custom blocks, no lists.
//   1  aim: the cannon points towards the mouse
//   2  shoot: a click makes a bullet clone that flies in the cannon's direction until it touches the edge
//   3  meteors: clones fall from random places; a bullet that touches one pops it and scores
//   4  lives and waves: a meteor that lands costs a life; meteors speed up with the score
//
// Speed is "direction + move steps", Scratch's own velocity model: the bullet points where the cannon points and moves.
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art } from "./art.ts";

export const LAST = 4;
const CANNON: [number, number] = [0, -150];
const BULLET_SPEED = 12, FALL = 2, GROUND = -140;

export function skyGuard(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Cannon: aim, shoot, keep score
  function cannonScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, eq, gt, or, and, set, change, ifThen, ifElse, whenFlag, forever, goto, pointToMouse, mouseDown, key,
      cloneOf, stopAll, div, add } = d;
    if (!at(1)) return B;
    B.script(whenFlag(), [
      goto(...CANNON),
      ...when(2, () => [set("cool", 0)]),
      ...when(3, () => [set("score", 0)]),
      ...when(4, () => [set("lives", 3), set("speed", FALL)]),
      forever([
        pointToMouse(),
        ...when(2, () => [
          // A click (or Space) shoots, with a short pause so one click is one bullet.
          ifElse(gt(v("cool"), 0), [change("cool", -1)], [
            ifThen(or(mouseDown(), key("space")), [cloneOf("Bullet"), set("cool", 8)]),
          ]),
        ]),
        ...when(4, () => [
          // The wave: meteors fall faster the more you have hit.
          set("speed", add(FALL, div(v("score"), 10))),
          // "stop all" also clears speech bubbles, so say it for a while first.
          ifThen(eq(v("lives"), 0), [d.sayFor("Game over! Click the green flag.", 2), stopAll()]),
        ]),
      ]),
    ], 20, 20);
    void and;
    return B;
  }

  // ---------------------------------------------------------------- Bullet: flies from the cannon in its direction
  function bulletScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { whenFlag, whenCloned, hide, show, goTo, point, of, until, or, touching, move, deleteClone, wait } = d;
    if (!at(2)) return B;
    B.script(whenFlag(), [hide()], 20, 20);
    B.script(whenCloned(), [
      goTo("Cannon"), point(of("direction", "Cannon")), show(),
      // Fly until the edge (or, from step 3, a meteor). Then stay a moment, so the meteor notices the hit.
      until(at(3) ? or(touching("_edge_"), touching("Meteor")) : touching("_edge_"), [move(BULLET_SPEED)]),
      ...when(3, () => [wait(0.05)]),
      deleteClone(),
    ], 20, 120);
    return B;
  }

  // ---------------------------------------------------------------- Meteor: falls, pops when a bullet touches it
  function meteorScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, lt, change, ifThen, whenFlag, whenCloned, forever, wait, random, goto, cloneMyself, hide, show, until,
      changeY, touching, deleteClone, yPos, mul } = d;
    if (!at(3)) return B;
    // The Meteor sprite itself only makes clones, at a random place above the screen.
    B.script(whenFlag(), [hide(), forever([
      wait(random(0.6, 1.6)), goto(random(-220, 220), 190), cloneMyself(),
    ])], 20, 20);
    B.script(whenCloned(), [
      show(),
      until(lt(yPos(), GROUND), [
        changeY(at(4) ? mul(v("speed"), -1) : -FALL),
        ifThen(touching("Bullet"), [change("score", 1), deleteClone()]),
      ]),
      // Landed: from step 4 that costs a life.
      ...when(4, () => [change("lives", -1)]),
      deleteClone(),
    ], 20, 200);
    return B;
  }

  const A = art(P);
  return P.build({
    backdrop: A.backdrop,
    sprites: [
      P.sprite("Meteor", { blocks: meteorScripts(), costumes: A.meteor, layer: 1, visible: false }),
      P.sprite("Bullet", { blocks: bulletScripts(), costumes: A.bullet, layer: 2, visible: false }),
      P.sprite("Cannon", { blocks: cannonScripts(), costumes: A.cannon, layer: 3, x: CANNON[0], y: CANNON[1] }),
    ],
    shown: [...(at(3) ? ["score"] : []), ...(at(4) ? ["lives"] : [])],
  });
}
