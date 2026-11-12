// Builds pizza-fractions.sb3: a maths game about fractions. Animal customers order a fraction of a pizza with pepperoni
// (3/4). Click slices to put pepperoni on them (they pop out); click SERVE. Right: a happy customer and coins. Wrong (or
// too slow): a heart, and the pizza shows the right slices before the customer leaves. Levels: halves and quarters;
// thirds, fifths, sixths; eighths to twelfths; equivalent fractions (1/2 on a pizza cut in 8); improper fractions over
// two pizzas (5/4); both; then a mix.
//
// The slices are a pool of 2 × 12 clones; slice s is pizza 1 + (s-1) div 12, piece (s-1) mod 12, and sel[s] says if it
// has pepperoni. A click is turned into a slice by its angle around the pizza's centre (a returning custom block).
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { textCostumes, textScripts, sparkCostumes, sparkScripts, kitLists, write, clear, pulse, emit } from "../math-kit/kit.ts";
import { art, R } from "./art.ts";

const P = new Project();
export const PER = 12, SLICES = 2 * PER, PY = -45, CUST_X = 178, CUST_Y = 0, BUBBLE = [62, 92], SERVE = [172, -128], BEADS = 8;
export const ONE_X = -80, TWO_X = [-155, 5], TWO_SCALE = 78;
const G = { score: 1, mult: 2, levelWord: 3, levelNum: 4, banner: 5, bannerNum: 6, title1: 7, title2: 8, click: 9,
  best: 10, bestWord: 11, pop: 12, num: 13, den: 14, praise: 15, quick: 16, serve: 17, bonusWord: 18 };

// ---------------------------------------------------------------- Stage: the game
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, or, and, not, join, set, change, ifThen, ifElse, repeat, until, whenFlag,
    whenReceive, forever, broadcast, wait, random, replace, define, call, ceiling, floor, mod, abs, sqrt, atan, switchBackdrop,
    arg, cond, max, min, ret, compute, fn, mouseX, mouseY, item, length } = d;

  B.script(whenFlag(), [
    set("phase", "title"), set("shake", 0), set("frame", 0), set("hideAbove", 400), set("score", 0), set("shown", 0),
    set("hearts", 3), set("level", 1), set("tap", 0), set("clickQ", 0), set("serveQ", 0), set("state", "none"),
    set("custX", 320), set("pizzas", 1), set("cut", 4), set("scale", 100), set("patience", 1), set("total", 1), set("kind", "cat"),
    set("s", 1), repeat(SLICES, [replace("sel", v("s"), 0), replace("bump", v("s"), 0), change("s", 1)]),
    replace("pizzaX", 1, ONE_X), replace("pizzaX", 2, 999),
    switchBackdrop("day"),
    call("title screen"),
    forever([
      change("frame", 1),
      set("shake", mul(v("shake"), 0.85)), ifThen(lt(v("shake"), 0.4), [set("shake", 0)]),
      set("shakeX", random(mul(v("shake"), -1), v("shake"))), set("shakeY", random(mul(v("shake"), -1), v("shake"))),
      set("press", v("tap")), set("tap", 0),
      set("clicked", v("clickQ")), set("clickQ", 0), set("serving", v("serveQ")), set("serveQ", 0),
      cond([
        [eq(v("phase"), "play"), [call("play")]],
        [or(eq(v("phase"), "title"), eq(v("phase"), "ready")), [
          replace("groupColor", G.title1, mul(v("frame"), 3)), replace("groupColor", G.title2, mul(v("frame"), 3)),
          ifThen(eq(mod(v("frame"), 20), 0), [pulse(d, G.click, 18)]),
          ifThen(eq(v("press"), 1), [call("new game")]),
        ]],
      ]),
      call("roll score"),
      broadcast("tick"),
    ]),
  ], 20, 20);
  // Input: every click is remembered with its position; the frame works out what it hit.
  const clickAt = [set("tap", 1), set("clickX", mouseX()), set("clickY", mouseY()), set("clickQ", 1)];
  B.script(d.whenStageClicked(), clickAt, 20, 900);
  B.script(whenReceive("text click"), clickAt, 20, 1000);
  B.script(whenReceive("other click"), clickAt, 20, 1100);
  B.script(d.whenKey("space"), [set("tap", 1), set("serveQ", 1)], 20, 1200);

  define("title screen", [
    ...write(d, { text: "word-pizza1", x: 0, y: 100, size: 120, group: G.title1 }),
    ...write(d, { text: "word-pizza2", x: 0, y: 42, size: 110, group: G.title2 }),
    ...write(d, { text: "word-clickplay", x: 0, y: -10, size: 50, group: G.click }),
    ifThen(gt(v("best"), 0), [
      ...write(d, { text: "word-best", x: -40, y: 157, size: 34, group: G.bestWord }),
      ...write(d, { text: v("best"), x: 50, y: 157, size: 40, group: G.best }),
    ]),
  ], { warp: true, x: 560, y: 20 });

  define("new game", [
    ...[G.title1, G.title2, G.click, G.best, G.bestWord, G.banner, G.bannerNum, G.bonusWord, G.mult, G.pop, G.praise, G.quick]
      .flatMap(g => clear(d, g)),
    set("score", 0), set("shown", -1), set("hearts", 3), set("level", 1), set("streak", 0), set("mult", 1),
    broadcast("hearts"), switchBackdrop("day"),
    set("phase", "play"),
    call("start level"),
  ], { warp: true, x: 560, y: 360 });

  define("start level", [
    set("served", 0), set("goal", 6),
    set("total", max(170, sub(420, mul(30, v("level"))))),
    ...write(d, { text: "word-level", x: -175, y: 122, size: 26, group: G.levelWord }),
    ...write(d, { text: v("level"), x: -122, y: 122, size: 32, group: G.levelNum }),
    ...write(d, { text: "word-level", x: -30, y: 40, size: 100, group: G.banner }),
    ...write(d, { text: v("level"), x: 115, y: 40, size: 120, group: G.bannerNum }),
    pulse(d, G.banner, 40), pulse(d, G.bannerNum, 40), set("bannerT", 50),
    call("next customer"),
  ], { warp: true, x: 560, y: 760 });

  // ---------------------------------------------------------------- orders
  define("next customer", [
    set("custX", 330), set("kind", item("kinds", random(1, length("kinds")))), set("state", "enter"),
    ...clear(d, G.num), ...clear(d, G.den), ...clear(d, G.serve),
    set("s", 1), repeat(SLICES, [replace("sel", v("s"), 0), change("s", 1)]),
    call("new order"),
  ], { warp: true, x: 1100, y: 20 });

  define("new order", [
    set("mode", v("level")), ifThen(gt(v("level"), 6), [set("mode", random(1, 6))]),
    set("pizzas", 1), set("k", 1),
    cond([
      [eq(v("mode"), 1), [set("b", item("dens1", random(1, length("dens1"))))]],
      [eq(v("mode"), 2), [set("b", item("dens2", random(1, length("dens2"))))]],
      [eq(v("mode"), 3), [set("b", item("dens3", random(1, length("dens3"))))]],
      // Equivalent: the pizza is cut into k times as many slices as the order says.
      [eq(v("mode"), 4), [set("b", item("dens4", random(1, length("dens4")))), set("k", random(2, 3)),
        ifThen(gt(mul(v("b"), v("k")), PER), [set("k", 2)])]],
      // Improper: more than one whole pizza (5/4), over two pizzas.
      [eq(v("mode"), 5), [set("b", item("dens4", random(1, length("dens4")))), set("pizzas", 2)]],
    ], [set("b", item("dens6", random(1, length("dens6")))), set("k", 2), set("pizzas", 2)]),
    set("cut", mul(v("b"), v("k"))),
    ifElse(eq(v("pizzas"), 1), [set("a", random(1, sub(v("b"), 1)))], [set("a", random(add(v("b"), 1), sub(mul(2, v("b")), 1)))]),
    set("need", mul(v("a"), v("k"))),
    ifElse(eq(v("pizzas"), 1), [set("scale", 100), replace("pizzaX", 1, ONE_X), replace("pizzaX", 2, 999)],
      [set("scale", TWO_SCALE), replace("pizzaX", 1, TWO_X[0]), replace("pizzaX", 2, TWO_X[1])]),
  ], { warp: true, x: 1100, y: 500 });

  define("show order", [
    ...clear(d, G.banner), ...clear(d, G.bannerNum), set("bannerT", 0),
    ...write(d, { text: v("a"), x: BUBBLE[0], y: BUBBLE[1] + 22, size: 46, group: G.num }),
    ...write(d, { text: v("b"), x: BUBBLE[0], y: BUBBLE[1] - 24, size: 46, group: G.den }),
    pulse(d, G.num, 40), pulse(d, G.den, 40),
    ...write(d, { text: "word-serve", x: SERVE[0], y: SERVE[1], size: 38, group: G.serve }),
  ], { warp: true, x: 1100, y: 1300 });

  // ---------------------------------------------------------------- one frame of play
  define("play", [
    ifThen(gt(v("bannerT"), 0), [change("bannerT", -1), ifThen(eq(v("bannerT"), 0), [...clear(d, G.banner), ...clear(d, G.bannerNum)])]),
    cond([
      [eq(v("state"), "enter"), [
        set("custX", add(v("custX"), mul(sub(CUST_X, v("custX")), 0.15))),
        ifThen(lt(abs(sub(v("custX"), CUST_X)), 2), [set("custX", CUST_X), set("patience", v("total")), call("show order"), set("state", "order")]),
      ]],
      [eq(v("state"), "order"), [
        change("patience", -1),
        ifThen(eq(v("clicked"), 1), [call("click at %s %s", v("clickX"), v("clickY"))]),
        cond([
          [eq(v("serving"), 1), [call("judge")]],
          [not(gt(v("patience"), 0)), [call("too slow")]],
        ]),
      ]],
      [or(eq(v("state"), "happy"), eq(v("state"), "fix")), [change("stateT", -1), ifThen(not(gt(v("stateT"), 0)), [set("state", "leave")])]],
      [eq(v("state"), "leave"), [
        change("custX", 9),
        ifThen(gt(v("custX"), 320), [
          ifElse(not(lt(v("served"), v("goal"))), [set("phase", "bonus"), set("state", "none"), broadcast("level done")], [call("next customer")])]),
      ]],
    ]),
  ], { warp: true, x: 1700, y: 20 });

  // A click: on a slice it toggles pepperoni; on the button it serves.
  define("click at %s %s", [
    set("cx", arg("x")), set("cy", arg("y")),
    ifThen(and(lt(abs(sub(v("cx"), SERVE[0])), 62), lt(abs(sub(v("cy"), SERVE[1])), 26)), [set("serving", 1)]),
    set("p", 1),
    repeat(v("pizzas"), [
      set("dx", sub(v("cx"), item("pizzaX", v("p")))), set("dy", sub(v("cy"), PY)),
      ifThen(lt(sqrt(add(mul(v("dx"), v("dx")), mul(v("dy"), v("dy")))), mul(R, div(v("scale"), 100))), [
        // The angle clockwise from straight up, 0 to 360, gives the slice.
        set("ang", atan(div(v("dx"), v("dy")))), ifThen(lt(v("dy"), 0), [change("ang", 180)]), set("ang", mod(v("ang"), 360)),
        set("s", add(add(mul(sub(v("p"), 1), PER), floor(div(v("ang"), div(360, v("cut"))))), 1)),
        replace("sel", v("s"), sub(1, item("sel", v("s")))), replace("bump", v("s"), 8),
      ]),
      change("p", 1),
    ]),
  ], { args: ["x", "y"], warp: true, x: 1700, y: 700 });

  define("judge", [
    set("count", 0), set("s", 1), repeat(SLICES, [change("count", item("sel", v("s"))), change("s", 1)]),
    ifElse(eq(v("count"), v("need")), [call("right")], [call("wrong")]),
  ], { warp: true, x: 1700, y: 1300 });

  define("right", [
    change("streak", 1), change("served", 1),
    set("mult", 1), cond([[gt(v("streak"), 7), [set("mult", 5)]], [gt(v("streak"), 4), [set("mult", 3)]], [gt(v("streak"), 2), [set("mult", 2)]]]),
    set("pts", mul(150, v("level"))),
    ifThen(gt(v("patience"), mul(0.6, v("total"))), [change("pts", 100),
      ...write(d, { text: "word-quick", x: -40, y: 70, size: 50, group: G.quick, mode: "float" })]),
    set("pts", mul(v("pts"), v("mult"))), change("score", v("pts")),
    ...write(d, { text: "word-thanks", x: CUST_X - 20, y: 75, size: 56, group: G.praise, mode: "float" }),
    ...write(d, { text: join("+", v("pts")), x: CUST_X, y: -40, size: 44, group: G.pop, mode: "float" }),
    ...emit(d, "confetti", CUST_X, 40, 10), ...emit(d, "spark", item("pizzaX", 1), PY, 14), set("shake", 3),
    ifElse(gt(v("mult"), 1), [
      ...write(d, { text: join("×", v("mult")), x: -82, y: 157, size: 34, group: G.mult }), pulse(d, G.mult, 40)],
      [...clear(d, G.mult)]),
    ...clear(d, G.serve), set("state", "happy"), set("stateT", 45),
  ], { warp: true, x: 2300, y: 20 });

  define("wrong", [
    set("shake", 8), set("flashKind", "red"), broadcast("flash"),
    ...write(d, { text: "word-oops", x: -40, y: 70, size: 70, group: G.praise, mode: "float" }),
    call("show right slices"), call("lose heart"),
  ], { warp: true, x: 2300, y: 800 });

  define("too slow", [
    ...write(d, { text: "word-slow", x: -40, y: 70, size: 70, group: G.praise, mode: "float" }),
    set("shake", 6), call("show right slices"), call("lose heart"),
  ], { warp: true, x: 2300, y: 1050 });

  // The pizza as it should have been: the first `need` slices with pepperoni.
  define("show right slices", [
    set("s", 1), set("left", v("need")),
    repeat(SLICES, [
      set("pp", add(floor(div(sub(v("s"), 1), PER)), 1)), set("pi", mod(sub(v("s"), 1), PER)),
      ifElse(and(gt(v("left"), 0), and(not(gt(v("pp"), v("pizzas"))), lt(v("pi"), v("cut")))), [replace("sel", v("s"), 1), change("left", -1)],
        [replace("sel", v("s"), 0)]),
      change("s", 1)]),
    pulse(d, G.num, 50), pulse(d, G.den, 50), ...clear(d, G.serve),
    set("state", "fix"), set("stateT", 70),
  ], { warp: true, x: 2300, y: 1300 });

  define("lose heart", [
    change("hearts", -1), broadcast("hearts"), set("streak", 0), set("mult", 1), ...clear(d, G.mult),
    ifThen(not(gt(v("hearts"), 0)), [set("phase", "over"), set("state", "none"), broadcast("game over")]),
  ], { warp: true, x: 2300, y: 1700 });

  // ---------------------------------------------------------------- level done, game over
  B.script(whenReceive("level done"), [
    ...write(d, { text: "word-levelup", x: 0, y: 60, size: 110, group: G.banner }), pulse(d, G.banner, 50),
    set("flashKind", "white"), broadcast("flash"),
    repeat(5, [...emit(d, "confetti", random(-200, 200), 190, 12), wait(0.12)]),
    set("bonus", mul(mul(v("hearts"), 500), v("level"))),
    ...write(d, { text: "word-bonus", x: -60, y: 0, size: 70, group: G.bonusWord }),
    set("bb", 0),
    until(eq(v("bb"), v("bonus")), [
      set("bb", min(v("bonus"), add(v("bb"), ceiling(div(v("bonus"), 25))))),
      ...write(d, { text: v("bb"), x: 80, y: 0, size: 80, group: G.bannerNum }),
      wait(0.03),
    ]),
    pulse(d, G.bannerNum, 50), change("score", v("bonus")),
    wait(1.2),
    ...[G.banner, G.bannerNum, G.bonusWord].flatMap(g => clear(d, g)),
    change("level", 1), set("hearts", min(3, add(v("hearts"), 1))), broadcast("hearts"),
    cond([[gt(v("level"), 4), [switchBackdrop("night")]], [gt(v("level"), 2), [switchBackdrop("evening")]]]),
    set("phase", "play"),
    call("start level"),
  ], 20, 1500);

  B.script(whenReceive("game over"), [
    ...[G.num, G.den, G.serve].flatMap(g => clear(d, g)),
    wait(1),
    set("state", "none"),
    ...write(d, { text: "word-gameover", x: 0, y: 95, size: 110, group: G.banner }), pulse(d, G.banner, 40),
    ...write(d, { text: v("score"), x: 0, y: 25, size: 90, group: G.bannerNum }),
    ifThen(gt(v("score"), v("best")), [set("best", v("score")),
      ...write(d, { text: "word-best", x: 0, y: -25, size: 56, group: G.bestWord }), pulse(d, G.bestWord, 50),
      repeat(4, [...emit(d, "confetti", random(-200, 200), 190, 10)])]),
    wait(1.5),
    ...write(d, { text: "word-clickplay", x: 0, y: -90, size: 50, group: G.click }),
    set("phase", "ready"),
  ], 20, 2300);

  define("roll score", [
    ifThen(and(not(eq(v("shown"), v("score"))), not(eq(v("phase"), "title"))), [
      ifElse(lt(v("shown"), 0), [set("shown", 0)], [change("shown", ceiling(div(sub(v("score"), v("shown")), 6)))]),
      ifThen(gt(v("shown"), v("score")), [set("shown", v("score"))]),
      ...write(d, { text: v("shown"), x: -165, y: 157, size: 46, group: G.score }), pulse(d, G.score, 14),
    ]),
  ], { warp: true, x: 2900, y: 20 });
  void ret; void compute; void fn;
  return B;
}

// The pizza is on show while a customer is at the counter.
const pizzaShown = (d: ReturnType<typeof dsl>) => {
  const { v, eq, or } = d;
  return or(or(eq(v("state"), "enter"), eq(v("state"), "order")), or(eq(v("state"), "happy"), eq(v("state"), "fix")));
};

// ---------------------------------------------------------------- Slice: a pool of 2 × 12 clones
function sliceScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "s", "pp", "pi", "pop");
  const d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, and, not, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned,
    hide, show, goto, cloneMyself, item, costumeTo, join, point, setSize, sin, cos, floor, mod, replace } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("s", 1), repeat(SLICES, [cloneMyself(), change("s", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), set("pp", add(floor(div(sub(v("s"), 1), PER)), 1)), set("pi", mod(sub(v("s"), 1), PER)), set("pop", 0)], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(and(pizzaShown(d), and(not(gt(v("pp"), v("pizzas"))), lt(v("pi"), v("cut")))), [
      // Slices with pepperoni pop out a little from the middle.
      set("pop", add(v("pop"), mul(sub(mul(9, item("sel", v("s"))), v("pop")), 0.3))),
      set("ang", mul(add(v("pi"), 0.5), div(360, v("cut")))),
      costumeTo(join(ifSel(d), v("cut"))), point(add(90, mul(v("pi"), div(360, v("cut"))))),
      setSize(add(v("scale"), mul(2, item("bump", v("s"))))),
      ifThen(gt(item("bump", v("s")), 0), [replace("bump", v("s"), sub(item("bump", v("s")), 1))]),
      goto(add(add(item("pizzaX", v("pp")), mul(v("pop"), sin(v("ang")))), v("shakeX")), add(add(PY, mul(v("pop"), cos(v("ang")))), v("shakeY"))),
      show()], [hide()]),
  ])], 20, 240);
  return B;
}
// "t" for a slice with pepperoni, "w" for a plain one (the costume names are t4, w4, ...).
const ifSel = (d: ReturnType<typeof dsl>) => d.letterOf(d.add(d.item("sel", d.v("s")), 1), "wt");

function boardScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "p");
  const d = dsl(B);
  const { v, eq, gt, not, and, set, ifThen, ifElse, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, item, setSize, add } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("p", 1), cloneMyself(), set("p", 2), cloneMyself()], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(and(pizzaShown(d), not(gt(v("p"), v("pizzas")))), [
      goto(add(item("pizzaX", v("p")), v("shakeX")), add(PY, v("shakeY"))), setSize(v("scale")), show()], [hide()]),
  ])], 20, 240);
  return B;
}

function customerScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, mul, div, eq, gt, or, set, ifElse, whenFlag, whenReceive, hide, show, goto, costumeTo, join, sin, abs, cond, setSize } = d;
  B.script(whenFlag(), [hide(), setSize(92)], 20, 20);
  B.script(whenReceive("tick"), [
    ifElse(or(eq(v("phase"), "play"), eq(v("phase"), "over")), [
      // The face shows the patience left (or the outcome).
      cond([
        [eq(v("state"), "happy"), [set("mood", "happy")]],
        [eq(v("state"), "fix"), [set("mood", "cross")]],
        [eq(v("state"), "leave"), []],
        [gt(v("patience"), mul(0.5, v("total"))), [set("mood", "happy")]],
        [gt(v("patience"), mul(0.2, v("total"))), [set("mood", "wait")]],
      ], [set("mood", "cross")]),
      costumeTo(join(join(v("kind"), "-"), v("mood"))),
      // A happy customer hops; walking is a bounce.
      set("hop", 0),
      ifElse(eq(v("state"), "happy"), [set("hop", abs(mul(14, sin(mul(v("frame"), 16)))))],
        [ifElse(or(eq(v("state"), "enter"), eq(v("state"), "leave")), [set("hop", abs(mul(5, sin(mul(v("frame"), 25)))))], [])]),
      goto(add(v("custX"), v("shakeX")), add(add(CUST_Y, v("hop")), v("shakeY"))), show()], [hide()]),
  ], 20, 120);
  void div;
  return B;
}

function bubbleScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, eq, or, and, ifElse, whenFlag, whenReceive, hide, show, goto, setSize } = d;
  B.script(whenFlag(), [hide(), goto(BUBBLE[0], BUBBLE[1]), setSize(100)], 20, 20);
  B.script(whenReceive("tick"), [ifElse(and(eq(v("phase"), "play"), or(or(eq(v("state"), "order"), eq(v("state"), "happy")), eq(v("state"), "fix"))),
    [show()], [hide()])], 20, 100);
  return B;
}
function serveScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, eq, and, ifElse, whenFlag, whenReceive, hide, show, goto } = d;
  B.script(whenFlag(), [hide(), goto(SERVE[0], SERVE[1])], 20, 20);
  B.script(whenReceive("tick"), [ifElse(and(eq(v("phase"), "play"), eq(v("state"), "order")), [show()], [hide()])], 20, 100);
  return B;
}
function beadScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "b");
  const d = dsl(B);
  const { v, add, mul, div, eq, and, gt, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, costume, ceiling } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("b", 1), repeat(BEADS, [goto(add(CUST_X - 86, mul(v("b"), 16)), -80), cloneMyself(), d.change("b", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(and(eq(v("phase"), "play"), eq(v("state"), "order")), [
      ifElse(gt(v("b"), ceiling(mul(div(v("patience"), v("total")), BEADS))), [costume("off")], [costume("on")]), show()], [hide()]),
  ])], 20, 240);
  void change;
  return B;
}
function heartScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "idx");
  const d = dsl(B);
  const { v, eq, gt, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, costume, add, mul } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("idx", 1), repeat(3, [goto(add(130, mul(v("idx"), 30)), 157), cloneMyself(), change("idx", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), costume("on"), show()], 20, 160);
  B.script(whenReceive("hearts"), [ifThen(eq(v("isClone"), 1), [ifElse(gt(v("idx"), v("hearts")), [costume("off")], [costume("on")])])], 20, 240);
  return B;
}
function flashScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.hide()], 20, 20);
  B.script(d.whenReceive("flash"), [d.costumeTo(d.v("flashKind")), d.setEffect("GHOST", 55), d.show(), d.front()], 20, 100);
  B.script(d.whenReceive("tick"), [d.changeEffect("GHOST", 8)], 20, 220);
  return B;
}
function hudScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, 157), d.show()], 20, 20);
  return B;
}
// Any sprite passes its clicks on; the Stage works out what was hit from the position.
const clickable = (B: Blocks) => { const d = dsl(B); B.script(d.whenClicked(), [d.broadcast("other click")], 300, 20); return B; };

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Customer", { blocks: clickable(customerScripts()), costumes: A.customer, layer: 1, visible: false }),
    P.sprite("Board", { blocks: clickable(boardScripts()), costumes: A.board, layer: 2, visible: false }),
    P.sprite("Slice", { blocks: clickable(sliceScripts()), costumes: A.slice, layer: 3, visible: false }),
    P.sprite("Bubble", { blocks: clickable(bubbleScripts()), costumes: A.bubble, layer: 4, visible: false }),
    P.sprite("Serve", { blocks: clickable(serveScripts()), costumes: A.serve, layer: 5, visible: false }),
    P.sprite("Bead", { blocks: clickable(beadScripts()), costumes: A.bead, layer: 6, visible: false }),
    P.sprite("Hud", { blocks: clickable(hudScripts()), costumes: A.hud, layer: 7, x: 0, y: 157 }),
    P.sprite("Heart", { blocks: clickable(heartScripts()), costumes: A.heart, layer: 8, visible: false }),
    P.sprite("Spark", { blocks: sparkScripts(P), costumes: sparkCostumes(P), layer: 9, visible: false }),
    P.sprite("Text", { blocks: textScripts(P), costumes: textCostumes(P, "pizza-fractions"), layer: 10, visible: false }),
    P.sprite("Flash", { blocks: clickable(flashScripts()), costumes: A.flash, layer: 11, visible: false }),
  ],
  listValues: {
    ...kitLists(),
    sel: Array(SLICES).fill(0), bump: Array(SLICES).fill(0), pizzaX: [ONE_X, 999], kinds: A.kinds,
    dens1: [2, 4], dens2: [3, 5, 6], dens3: [8, 10, 12], dens4: [2, 3, 4], dens6: [2, 3],
  },
  shown: [],
});
writeFileSync(new URL("pizza-fractions.sb3", import.meta.url), sb3);
console.log(`pizza-fractions.sb3: ${sb3.length} bytes`);
