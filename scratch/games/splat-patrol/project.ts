// Splat Patrol, as a function of the tutorial step: splatPatrol(5) is the whole game, 1..4 are the tutorial's
// checkpoints, 0 is the starter (artwork, no code). Basic blocks only: no custom blocks, no lists.
//   1  open and close: a window opens after a random wait, a raccoon looks out, the window shuts again
//   2  splat!: the crosshair follows the mouse; clicking it broadcasts `splat`; the open window under the mouse is hit
//   3  a whole house: the Window sprite places a clone on every window spot; each clone runs the same script
//   4  raccoons splat back: a raccoon that is not hit in time splats you; splashing a villager costs a life too
//   5  round after round: the houses take turns, and two numbers make each round harder
//   6  deluxe (not in the tutorial): raccoons in disguise, a golden raccoon, splash particles, score pop-ups and combos,
//      swinging shutters, shaking windows, crosshair recoil, a round banner, hearts, evening falls, birds
//
// Clicks: the crosshair is on top of everything, so it gets the click and broadcasts `splat`; the window that is
// touching the mouse-pointer takes the hit. Time: windows stay open until the timer passes `close`, not for a number
// of loop passes (a loop can run several times in one frame when nothing moves on the screen).
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { art, deluxeArt, HOUSES } from "./art.ts";

export const LAST = 5;      // the tutorial's last step: the game it teaches
export const DELUXE = 6;    // the bonus level: the same game with disguises, particles and other extras
const ROUND_SECONDS = 15;

export function splatPatrol(step: number): Buffer {
  const P = new Project();
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Stage: rounds, houses and the two numbers
  function stageScripts(): Blocks {
    if (at(DELUXE)) return deluxeStage();
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
    if (at(DELUXE)) return deluxeWindow();
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
    if (at(DELUXE)) return deluxeCrosshair();
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

  // ================================================================ the deluxe level (step 6)
  const capped = (d: ReturnType<typeof dsl>, name: string, value: In, max: number) =>
    [d.set(name, value), d.ifThen(d.gt(d.v(name), max), [d.set(name, max)])];

  // Stage: as in step 5, plus disguises that grow with the round, evening light, and the round banner.
  function deluxeStage(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, add, sub, mul, lt, set, change, ifThen, whenFlag, forever, broadcast, broadcastWait, wait, switchBackdrop, mod } = d;
    B.script(whenFlag(), [
      set("round", 1),
      forever([
        set("showTime", sub(2.2, mul(v("round"), 0.2))), ifThen(lt(v("showTime"), 0.7), [set("showTime", 0.7)]),
        ...capped(d, "badChance", add(50, mul(v("round"), 8)), 85),
        // From round 2, more and more raccoons come in disguise.
        ...capped(d, "disguise", mul(sub(v("round"), 1), 15), 60),
        set("house", add(mod(sub(v("round"), 1), HOUSES.length), 1)),
        switchBackdrop(v("house")),
        // Evening falls: the sky gets a little darker every round.
        set("dusk", mul(sub(v("round"), 1), -10)), ifThen(lt(v("dusk"), -40), [set("dusk", -40)]),
        d.setEffect("BRIGHTNESS", v("dusk")),
        broadcastWait("clear"), broadcastWait("build"), broadcast("banner"),
        wait(ROUND_SECONDS),
        change("round", 1),
      ]),
    ], 20, 20);
    return B;
  }

  // Window: shutters swing open; someone looks out (maybe a raccoon in disguise, who winks once); splat or be splatted.
  function deluxeWindow(): Blocks {
    const B = new Blocks(P).local("who", "hit", "close", "isClone", "bad", "showing", "wink", "homeX", "homeY", "points");
    const d = dsl(B);
    const { v, add, mul, div, eq, lt, gt, or, and, join, set, change, ifThen, ifElse, whenFlag, whenReceive, whenCloned,
      forever, until, repeat, wait, random, costume, costumeTo, show, hide, goto, cloneMyself, deleteClone, touching, timer,
      broadcast, xPos, yPos, floor } = d;
    const build = (h: number) => HOUSES[h].windows.flatMap(([x, y]) => [goto(x, y), cloneMyself()]);
    B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
    B.script(whenReceive("build"), [ifThen(eq(v("isClone"), 0),
      HOUSES.map((_, h) => ifThen(eq(v("house"), h + 1), build(h))))], 20, 100);
    B.script(whenReceive("clear"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 260);
    const disguised = () => or(eq(v("who"), "raccoon granny"), eq(v("who"), "raccoon kid"));
    B.script(whenCloned(), [
      set("isClone", 1), set("homeX", xPos()), set("homeY", yPos()), set("showing", 0), costume("shut"), show(),
      forever([
        wait(random(1, 3)),
        // The shutters swing open in two quick pictures.
        costume("half"), wait(0.06), costume("open"), wait(0.08),
        // Who is it? A raccoon (sometimes in disguise, now and then golden), or a villager.
        ifElse(lt(random(1, 100), v("badChance")), [
          set("bad", 1), set("who", "raccoon"),
          ifThen(lt(random(1, 100), v("disguise")), [ifElse(eq(random(1, 2), 1), [set("who", "raccoon granny")], [set("who", "raccoon kid")])]),
          ifThen(eq(random(1, 30), 1), [set("who", "golden")]),
        ], [
          set("bad", 0), ifElse(eq(random(1, 2), 1), [set("who", "granny")], [set("who", "kid")]),
        ]),
        costumeTo(v("who")), set("hit", 0), set("showing", 1),
        set("close", add(timer(), v("showTime"))), set("wink", add(timer(), div(v("showTime"), 2))),
        until(or(eq(v("hit"), 1), gt(timer(), v("close"))), [
          // A raccoon in disguise winks once, half way: for a moment you see its mask.
          ifThen(and(disguised(), gt(timer(), v("wink"))), [
            set("wink", add(v("close"), 1)), costume("raccoon"), wait(0.12),
            ifThen(eq(v("hit"), 0), [costumeTo(v("who"))]),
          ]),
          wait(0.02),
        ]),
        set("showing", 0),
        ifThen(and(eq(v("hit"), 0), eq(v("bad"), 1)), [broadcast("splatted")]),
        ifThen(eq(v("hit"), 1), [wait(0.6)]),
        costume("shut"),
      ]),
    ], 400, 20);
    B.script(whenReceive("splat"), [
      ifThen(and(and(eq(v("hit"), 0), eq(v("showing"), 1)), touching("_mouse_")), [
        set("hit", 1), costumeTo(join(v("who"), " splat")),
        set("fxX", xPos()), set("fxY", yPos()),
        ifElse(eq(v("bad"), 1), [
          // Points: 1 for a raccoon, 3 for one in disguise, 5 for the golden one; times the combo.
          set("points", 1), ifThen(disguised(), [set("points", 3)]), ifThen(eq(v("who"), "golden"), [set("points", 5)]),
          change("streak", 1),
          ...capped(d, "combo", add(1, floor(div(v("streak"), 3))), 4),
          change("score", mul(v("points"), v("combo"))),
          set("fxText", join("+", v("points"))), set("fxKind", v("who")), broadcast("burst"),
          ifThen(and(gt(v("combo"), 1), eq(d.mod(v("streak"), 3), 0)), [broadcast("combo")]),
        ], [
          set("fxText", "oops"), set("fxKind", "villager"), broadcast("burst"), broadcast("oops"),
        ]),
      ]),
    ], 400, 900);
    // When a raccoon splats you, the whole house shakes for a moment.
    B.script(whenReceive("shake"), [ifThen(eq(v("isClone"), 1), [
      repeat(8, [goto(add(v("homeX"), random(-5, 5)), add(v("homeY"), random(-4, 4)))]),
      goto(v("homeX"), v("homeY")),
    ])], 20, 380);
    return B;
  }

  // Crosshair: recoil on every shot; counts lives; a hit in a row raises the combo, a miss resets it.
  function deluxeCrosshair(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    const { v, eq, gt, set, change, ifThen, whenFlag, whenClicked, whenReceive, forever, goTo, front, broadcast, sayFor,
      stopAll } = d;
    B.script(whenFlag(), [
      set("score", 0), set("lives", 3), set("streak", 0), set("combo", 1), d.say(""), d.setSize(100),
      forever([goTo("_mouse_"), front(), ifThen(gt(d.size(), 100), [d.changeSize(-7)])]),
    ], 20, 20);
    B.script(whenClicked(), [broadcast("splat"), d.setSize(135)], 20, 200);
    for (const msg of ["splatted", "oops"] as const)
      B.script(whenReceive(msg), [
        change("lives", -1), set("streak", 0), set("combo", 1),
        ...(msg === "splatted" ? [broadcast("shake")] : []),
        ifThen(eq(v("lives"), 0), [sayFor("Game over! Click the green flag.", 2), stopAll()]),
        ...(msg === "oops" ? [sayFor("Oops! Sorry!", 1)] : []),
      ], 20, msg === "splatted" ? 300 : 500);
    return B;
  }

  // Drop: a splash of water drops (sparkles for the golden raccoon) that fly out, fall and fade.
  function dropScripts(): Blocks {
    const B = new Blocks(P).local("isClone", "speed", "vy");
    const d = dsl(B);
    const { v, eq, set, change, ifThen, ifElse, whenFlag, whenReceive, whenCloned, repeat, goto, cloneMyself, deleteClone,
      hide, show, random, point, move, changeY, costume } = d;
    B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
    B.script(whenReceive("burst"), [ifThen(eq(v("isClone"), 0), [
      goto(v("fxX"), v("fxY")), ifElse(eq(v("fxKind"), "golden"), [costume("spark")], [costume("drop")]),
      d.call("splash"),
    ])], 20, 100);
    // All ten drops at once: without screen refresh, the repeat doesn't pause between clones.
    d.define("splash", [repeat(10, [cloneMyself()])], { warp: true, x: 420, y: 100 });
    B.script(whenCloned(), [
      set("isClone", 1), point(random(-180, 180)), set("speed", random(2, 5)), set("vy", random(2, 6)), show(),
      repeat(24, [move(v("speed")), changeY(v("vy")), change("vy", -0.5), d.changeEffect("GHOST", 4), d.changeSize(-2)]),
      deleteClone(),
    ], 20, 260);
    return B;
  }

  // Popup: "+3", "COMBO x2", "OOPS!" float up from the window and fade.
  function popupScripts(): Blocks {
    const B = new Blocks(P).local("isClone");
    const d = dsl(B);
    const { v, eq, add, join, set, ifThen, whenFlag, whenReceive, whenCloned, repeat, goto, cloneMyself, deleteClone, hide,
      show, costumeTo, changeY } = d;
    B.script(whenFlag(), [hide(), set("isClone", 0)], 20, 20);
    B.script(whenReceive("burst"), [ifThen(eq(v("isClone"), 0), [
      goto(v("fxX"), add(v("fxY"), 30)), costumeTo(v("fxText")), cloneMyself()])], 20, 100);
    B.script(whenReceive("combo"), [ifThen(eq(v("isClone"), 0), [
      goto(v("fxX"), add(v("fxY"), 62)), costumeTo(join("x", v("combo"))), cloneMyself()])], 20, 200);
    B.script(whenCloned(), [set("isClone", 1), show(), d.front(),
      repeat(28, [changeY(1.5), d.changeEffect("GHOST", 3.5)]), deleteClone()], 20, 300);
    return B;
  }

  // Banner: the house's name slides in at the start of each round, waits, and slides out.
  function bannerScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    B.script(d.whenFlag(), [d.hide()], 20, 20);
    B.script(d.whenReceive("banner"), [
      // Along the grass at the bottom, so it doesn't hide any windows.
      d.costumeTo(d.v("house")), d.goto(-400, -152), d.show(), d.front(),
      d.repeat(20, [d.changeX(20)]), d.wait(1.2), d.repeat(20, [d.changeX(20)]), d.hide(),
    ], 20, 100);
    return B;
  }

  // Bird: now and then a bird flaps across the sky.
  function birdScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    B.script(d.whenFlag(), [d.hide(), d.forever([
      d.wait(d.random(2, 6)), d.goto(-250, d.random(120, 165)), d.show(),
      d.until(d.gt(d.xPos(), 245), [d.repeat(4, [d.changeX(2.5)]), d.nextCostume()]),
      d.hide(),
    ])], 20, 20);
    return B;
  }

  // Hearts: the lives as hearts, top right.
  function heartsScripts(): Blocks {
    const B = new Blocks(P), d = dsl(B);
    B.script(d.whenFlag(), [d.goto(178, 158), d.show(), d.forever([d.costumeTo(d.join("h", d.v("lives")))])], 20, 20);
    return B;
  }

  const A = art(P);
  const X = at(DELUXE) ? deluxeArt(P) : null;
  return P.build({
    backdrop: A.backdrops,
    stage: stageScripts(),
    sprites: [
      P.sprite("Window", { blocks: windowScripts(), costumes: X ? [...A.window, ...X.window] : A.window, layer: 1,
        x: HOUSES[0].windows[0][0], y: HOUSES[0].windows[0][1] }),
      ...(X ? [P.sprite("Bird", { blocks: birdScripts(), costumes: X.bird, layer: 2, visible: false })] : []),
      P.sprite("Goo", { blocks: gooScripts(), costumes: A.goo, layer: X ? 3 : 2, visible: false }),
      ...(X ? [
        P.sprite("Drop", { blocks: dropScripts(), costumes: X.drop, layer: 4, visible: false }),
        P.sprite("Popup", { blocks: popupScripts(), costumes: X.popup, layer: 5, visible: false }),
        P.sprite("Banner", { blocks: bannerScripts(), costumes: X.banner, layer: 6, visible: false }),
        P.sprite("Hearts", { blocks: heartsScripts(), costumes: X.hearts, layer: 7, x: 178, y: 158 }),
      ] : []),
      P.sprite("Crosshair", { blocks: crosshairScripts(), costumes: A.crosshair, layer: X ? 8 : 3 }),
    ],
    shown: at(DELUXE) ? ["score", "round"]
      : [...(at(2) ? ["score"] : []), ...(at(4) ? ["lives"] : []), ...(at(5) ? ["round"] : [])],
  });
}
