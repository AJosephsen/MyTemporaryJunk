// Splat Patrol, as a function of the tutorial step: splatPatrol(5) is the whole game, 1..4 are the tutorial's
// checkpoints, 0 is the starter (artwork, no code). Basic blocks only: no custom blocks, no lists.
//   1  open and close: a window opens after a random wait, a raccoon looks out, the window shuts again
//   2  splat!: the crosshair follows the mouse; clicking it broadcasts `splat`; the open window under the mouse is hit
//   3  a whole house: the Window sprite places a clone on every window spot; each clone runs the same script
//   4  raccoons splat back: a raccoon that is not hit in time splats you; splashing a villager costs a life too
//   5  round after round: the houses take turns, and two numbers make each round harder
//
// Clicks: the crosshair is on top of everything, so it gets the click and broadcasts `splat`; the window that is
// touching the mouse-pointer takes the hit. Time: windows stay open until the timer passes `close`, not for a number
// of loop passes (a loop can run several times in one frame when nothing moves on the screen).
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { art, HOUSES } from "./art.ts";

export const LAST = 5;
const ROUND_SECONDS = 15;

export function splatPatrol(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Stage: rounds, houses and the two numbers
  function stageScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, add, sub, mul, gt, lt, set, change, ifThen, whenFlag, forever, broadcastWait, wait, switchBackdrop, mod } = d;
    if (!at(5)) return B;
    B.script(whenFlag(), [
      set("round", 1),
      forever([
        // Two numbers make the round harder: less time to splat, and more raccoons.
        set("showTime", sub(2.2, mul(v("round"), 0.2))), ifThen(lt(v("showTime"), 0.7), [set("showTime", 0.7)]),
        set("badChance", add(50, mul(v("round"), 8))), ifThen(gt(v("badChance"), 85), [set("badChance", 85)]),
        // The houses take turns: 1, 2, 3, 1, 2, 3, ...
        set("house", add(mod(sub(v("round"), 1), HOUSES.length), 1)),
        switchBackdrop(v("house")),
        broadcastWait("clear"), broadcastWait("build"),
        wait(ROUND_SECONDS),
        change("round", 1),
      ]),
    ], 20, 20);
    return B;
  }

  // ---------------------------------------------------------------- Window: open, someone looks out, shut
  function windowScripts(): Blocks {
    const B = new Blocks(P).local(...(at(2) ? ["who", "hit"] : []), ...(at(3) ? ["isClone"] : []), ...(at(2) ? ["close"] : []));
    const d = dsl(B);
    const { v, add, eq, lt, gt, or, and, join, set, change, ifThen, ifElse, whenFlag, whenReceive, whenCloned, forever, until,
      wait, random, costume, costumeTo, show, hide, goto, cloneMyself, deleteClone, touching, timer, broadcast } = d;
    if (!at(1)) return B;

    // Who looks out? From step 2 a raccoon or a villager (granny or kid); badChance is the raccoons' share.
    const choose = at(2)
      ? [ifElse(lt(random(1, 100), at(5) ? v("badChance") : 60), [set("who", "raccoon")],
          [ifElse(eq(random(1, 2), 1), [set("who", "granny")], [set("who", "kid")])])]
      : [];
    const showTime = at(5) ? v("showTime") : 1.5;
    // The window's life: wait, open, someone looks out until splatted or out of time, then shut.
    const life = at(2) ? [
      wait(random(1, 3)),
      costume("open"), wait(0.15),
      ...choose, costumeTo(v("who")), set("hit", 0),
      set("close", add(timer(), showTime)),
      until(or(eq(v("hit"), 1), gt(timer(), v("close"))), [wait(0.02)]),
      ...when(4, () => [
        // Out of time and it was a raccoon: it splats you.
        ifThen(and(eq(v("hit"), 0), eq(v("who"), "raccoon")), [broadcast("splatted")]),
      ]),
      ifThen(eq(v("hit"), 1), [wait(0.6)]),
      costume("shut"),
    ] : [wait(random(1, 3)), costume("raccoon"), wait(1.5), costume("shut")];

    if (at(3)) {
      // The Window sprite itself only builds the house: one clone on every window spot.
      const build = (h: number) => HOUSES[h].windows.flatMap(([x, y]) => [goto(x, y), cloneMyself()]);
      if (at(5)) {
        B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
        B.script(whenReceive("build"), [ifThen(eq(v("isClone"), 0),
          HOUSES.map((_, h) => ifThen(eq(v("house"), h + 1), build(h))))], 20, 100);
        B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 260);
      } else {
        B.script(whenFlag(), [hide(), set("isClone", 0), ...build(0)], 20, 20);
      }
      B.script(whenCloned(), [set("isClone", 1), costume("shut"), show(), forever(life)], 400, 20);
    } else {
      B.script(whenFlag(), [goto(...HOUSES[0].windows[0]), costume("shut"), show(), forever(life)], 20, 20);
    }

    // Splat! Only an open window with someone in it, under the mouse-pointer, is hit. (No waiting here: a second
    // splat would restart this script in the middle of a wait.)
    if (at(2)) B.script(whenReceive("splat"), [
      // Costumes 3, 4 and 5 are the raccoon, the granny and the kid looking out.
      ifThen(and(and(eq(v("hit"), 0), touching("_mouse_")), and(gt(d.costumeNumber(), 2), lt(d.costumeNumber(), 6))), [
        set("hit", 1), costumeTo(join(v("who"), " splat")),
        ifElse(eq(v("who"), "raccoon"), [change("score", 1)], at(4) ? [broadcast("oops")] : [change("score", -1)]),
      ]),
    ], 400, 300);
    return B;
  }

  // ---------------------------------------------------------------- Crosshair: follows the mouse, clicking it splats
  function crosshairScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, eq, set, change, ifThen, whenFlag, whenClicked, whenReceive, forever, goTo, front, broadcast, say, sayFor,
      stopAll } = d;
    if (!at(1)) return B;
    B.script(whenFlag(), [
      ...when(2, () => [set("score", 0)]), ...when(4, () => [set("lives", 3), say("")]),
      front(), forever([goTo("_mouse_")]),
    ], 20, 20);
    if (at(2)) B.script(whenClicked(), [broadcast("splat")], 20, 200);
    if (at(4)) {
      // Splatted by a raccoon, or splashed a villager: a life is gone.
      for (const msg of ["splatted", "oops"] as const)
        B.script(whenReceive(msg), [
          change("lives", -1),
          ifThen(eq(v("lives"), 0), [sayFor("Game over! Click the green flag.", 2), stopAll()]),
          // Say sorry for a moment only ("say" without a time would stay on the screen).
          ...(msg === "oops" ? [sayFor("Oops! Sorry!", 1)] : []),
        ], 20, msg === "splatted" ? 300 : 460);
    }
    return B;
  }

  // ---------------------------------------------------------------- Goo: shows for a moment when a raccoon splats you
  function gooScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    if (!at(4)) return B;
    B.script(d.whenFlag(), [d.hide()], 20, 20);
    B.script(d.whenReceive("splatted"), [d.show(), d.front(), d.wait(0.4), d.hide()], 20, 100);
    return B;
  }

  const A = art(P);
  return P.build({
    backdrop: A.backdrops,
    stage: stageScripts(),
    sprites: [
      P.sprite("Window", { blocks: windowScripts(), costumes: A.window, layer: 1, x: HOUSES[0].windows[0][0], y: HOUSES[0].windows[0][1] }),
      P.sprite("Goo", { blocks: gooScripts(), costumes: A.goo, layer: 2, visible: false }),
      P.sprite("Crosshair", { blocks: crosshairScripts(), costumes: A.crosshair, layer: 3 }),
    ],
    shown: [...(at(2) ? ["score"] : []), ...(at(4) ? ["lives"] : []), ...(at(5) ? ["round"] : [])],
  });
}
