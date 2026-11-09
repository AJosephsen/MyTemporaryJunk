// Sheepdog, as a function of the tutorial step: sheepdog(4) is the whole game, 1..3 are the tutorial's checkpoints,
// 0 is the starter (artwork, no code). Basic blocks only: no custom blocks, no lists.
//   1  the dog follows the mouse: point towards, move
//   2  sheep graze: 8 clones wander with a random turn and bounce off the edges
//   3  sheep flee: distance to Dog < 70 → point towards Dog, turn 180, move
//   4  the pen and the clock: a sheep that touches the Pen stays; all 8 inside wins, the timer is the score
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art, PEN } from "./art.ts";

export const LAST = 4;
const SHEEP = 8, SCARE = 70;

export function sheepdog(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Dog: follows the mouse
  function dogScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, gt, eq, set, ifThen, whenFlag, forever, goto, pointTowards, distanceTo, move, round, timer, resetTimer,
      sayFor, stopAll, join } = d;
    if (!at(1)) return B;
    B.script(whenFlag(), [
      goto(-180, -120),
      ...when(4, () => [set("inside", 0), resetTimer()]),
      forever([
        // Run to the mouse, but stop when close, so the dog doesn't jitter under the pointer.
        ifThen(gt(distanceTo("_mouse_"), 10), [pointTowards("_mouse_"), move(4)]),
        ...when(4, () => [
          set("time", round(timer())),
          ifThen(eq(v("inside"), SHEEP), [sayFor(join("Well done! ", join(v("time"), " seconds")), 3), stopAll()]),
        ]),
      ]),
    ], 20, 20);
    return B;
  }

  // ---------------------------------------------------------------- Sheep: graze, flee from the dog, stay in the pen
  function sheepScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, lt, ifThen, whenFlag, whenCloned, hide, show, repeat, goto, random, cloneMyself, forever, until, turn, move,
      bounceOnEdge, pointTowards, distanceTo, touching, change } = d;
    if (!at(2)) return B;
    // The Sheep sprite itself only makes the flock, on the left half of the field.
    B.script(whenFlag(), [hide(), repeat(SHEEP, [goto(random(-200, -20), random(-150, 150)), cloneMyself()])], 20, 20);
    const graze = [turn(random(-15, 15)), move(1), bounceOnEdge()];
    const flee = when(3, () => [ifThen(lt(distanceTo("Dog"), SCARE), [pointTowards("Dog"), turn(180), move(3)])]);
    B.script(whenCloned(), [
      show(),
      ...(at(4)
        ? [until(touching("Pen"), [...graze, ...flee]), change("inside", 1)]   // in the pen: stop and count
        : [forever([...graze, ...flee])]),
    ], 20, 140);
    return B;
  }

  const A = art(P);
  return P.build({
    backdrop: A.backdrop,
    sprites: [
      P.sprite("Pen", { blocks: new Blocks(P), costumes: A.pen, layer: 1, x: PEN.x, y: PEN.y, visible: at(4) }),
      P.sprite("Sheep", { blocks: sheepScripts(), costumes: A.sheep, layer: 2, visible: false }),
      P.sprite("Dog", { blocks: dogScripts(), costumes: A.dog, layer: 3, x: -180, y: -120 }),
    ],
    shown: at(4) ? ["inside", "time"] : [],
  });
}
