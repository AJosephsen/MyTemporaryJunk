// Builds greater-gator.sb3: a maths game about comparing numbers. Two lily pads drift towards the gator, each with a
// number (later a sum, a negative number, a decimal or a fraction). Click the bigger one (or ← →) and the gator eats
// it; the comparison shows: 47 > 38. From level 5 two can be equal (0.5 and 0.50): click the gator (or ↓ / Space).
// The wrong choice, or waiting until the pads reach the gator, costs a heart. The gator grows with every right answer
// in a row.
//
// A click is judged by where it is: the left part of the stage means the left pad, the right part the right pad, the
// middle the gator. So it never matters which sprite or text is under the finger.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { textCostumes, textScripts, sparkCostumes, sparkScripts, kitLists, write, clear, pulse, emit } from "../math-kit/kit.ts";
import { art } from "./art.ts";

const P = new Project();
export const PAD_Y = -60, START_X = 205, TOUCH_X = 100, GATOR_Y = -110, MIDDLE = 60;
const G = { score: 1, mult: 2, levelWord: 3, levelNum: 4, banner: 5, bannerNum: 6, title1: 7, title2: 8, click: 9,
  best: 10, bestWord: 11, pop: 12, cmp: 13, praise: 14, bonusWord: 15, quick: 16, same: 17, pad: 20 };   // pad side s: 20 + s

// ---------------------------------------------------------------- Stage: the game
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, or, and, not, join, set, change, ifThen, ifElse, repeat, until, whenFlag,
    whenReceive, forever, broadcast, wait, random, replace, define, call, ceiling, floor, mod, abs, sin, switchBackdrop,
    arg, cond, max, min, ret, compute, fn, mouseX, item } = d;

  B.script(whenFlag(), [
    set("phase", "title"), set("shake", 0), set("frame", 0), set("hideAbove", 400), set("score", 0), set("shown", 0),
    set("hearts", 3), set("level", 1), set("tap", 0), set("pickQ", 0), set("state", "none"), set("gsize", 80),
    set("gatorX", 0), set("face", 90), set("eatT", 0), set("sameOk", 0),
    replace("slotY", 1, 9999), replace("slotY", 2, 9999),
    switchBackdrop("day"),
    call("title screen"),
    forever([
      change("frame", 1),
      set("shake", mul(v("shake"), 0.85)), ifThen(lt(v("shake"), 0.4), [set("shake", 0)]),
      set("shakeX", random(mul(v("shake"), -1), v("shake"))), set("shakeY", random(mul(v("shake"), -1), v("shake"))),
      set("press", v("tap")), set("tap", 0), set("pick", v("pickQ")), set("pickQ", 0),
      cond([
        [eq(v("phase"), "play"), [call("play")]],
        [or(eq(v("phase"), "title"), eq(v("phase"), "ready")), [
          replace("groupColor", G.title1, mul(v("frame"), 3)), replace("groupColor", G.title2, mul(v("frame"), 3)),
          ifThen(eq(mod(v("frame"), 20), 0), [pulse(d, G.click, 18)]),
          ifThen(or(eq(v("press"), 1), gt(v("pick"), 0)), [call("new game")]),
        ]],
      ]),
      call("roll score"),
      broadcast("tick"),
    ]),
  ], 20, 20);
  // Clicks are judged by where they are (see the top of this file); keys too.
  const clickAt = [set("tap", 1), cond([[lt(mouseX(), -MIDDLE), [set("pickQ", 1)]], [gt(mouseX(), MIDDLE), [set("pickQ", 2)]]], [set("pickQ", 3)])];
  B.script(d.whenStageClicked(), clickAt, 20, 900);
  B.script(whenReceive("text click"), clickAt, 20, 1000);
  B.script(whenReceive("other click"), clickAt, 20, 1100);
  B.script(d.whenKey("left arrow"), [set("pickQ", 1)], 20, 1200);
  B.script(d.whenKey("right arrow"), [set("pickQ", 2)], 20, 1260);
  B.script(d.whenKey("down arrow"), [set("pickQ", 3)], 20, 1320);
  B.script(d.whenKey("space"), [set("tap", 1), set("pickQ", 3)], 20, 1380);

  define("title screen", [
    ...write(d, { text: "word-gator1", x: 0, y: 90, size: 110, group: G.title1 }),
    ...write(d, { text: "word-gator2", x: 0, y: 30, size: 140, group: G.title2 }),
    ...write(d, { text: "word-clickplay", x: 0, y: -25, size: 50, group: G.click }),
    ifThen(gt(v("best"), 0), [
      ...write(d, { text: "word-best", x: -40, y: 157, size: 34, group: G.bestWord }),
      ...write(d, { text: v("best"), x: 50, y: 157, size: 40, group: G.best }),
    ]),
  ], { warp: true, x: 560, y: 20 });

  define("new game", [
    ...[G.title1, G.title2, G.click, G.best, G.bestWord, G.banner, G.bannerNum, G.bonusWord, G.mult, G.pop, G.praise, G.quick, G.cmp]
      .flatMap(g => clear(d, g)),
    set("score", 0), set("shown", -1), set("hearts", 3), set("level", 1), set("streak", 0), set("mult", 1), set("gsize", 80),
    broadcast("hearts"), switchBackdrop("day"),
    set("phase", "play"),
    call("start level"),
  ], { warp: true, x: 560, y: 360 });

  define("start level", [
    set("pairsDone", 0), set("goal", 8),
    // The pads take less time to reach the gator each level.
    set("speed", div(sub(START_X, TOUCH_X), max(70, sub(210, mul(18, v("level")))))),
    set("sameOk", 0), ifThen(gt(v("level"), 4), [set("sameOk", 1)]),
    ...clear(d, G.same),
    ifThen(eq(v("sameOk"), 1), [...write(d, { text: "=", x: 0, y: -158, size: 46, group: G.same })]),
    ...write(d, { text: "word-level", x: -175, y: 122, size: 26, group: G.levelWord }),
    ...write(d, { text: v("level"), x: -122, y: 122, size: 32, group: G.levelNum }),
    ...write(d, { text: "word-level", x: -30, y: 50, size: 100, group: G.banner }),
    ...write(d, { text: v("level"), x: 115, y: 50, size: 120, group: G.bannerNum }),
    pulse(d, G.banner, 40), pulse(d, G.bannerNum, 40),
    set("state", "wait"), set("waitT", 45), set("clearBanner", 1),
  ], { warp: true, x: 560, y: 760 });

  // ---------------------------------------------------------------- pairs to compare
  // A whole number as text, with a proper minus sign (the font has −, not -).
  define("fmt %s", [ifElse(lt(arg("n"), 0), ret("fmt %s", join("−", abs(arg("n")))), ret("fmt %s", arg("n")))],
    { args: ["n"], warp: true, x: 1100, y: 20 });
  define("make pair", [
    set("mode", v("level")), ifThen(gt(v("level"), 6), [set("mode", random(1, 6))]),
    cond([
      // 1: numbers to 20.
      [eq(v("mode"), 1), [set("lv", random(1, 20)), set("rv", v("lv")), until(not(eq(v("rv"), v("lv"))), [set("rv", random(1, 20))]),
        set("lt", v("lv")), set("rt", v("rv"))]],
      // 2: two digits, often the same digits swapped (47 and 74).
      [eq(v("mode"), 2), [
        set("lv", random(12, 98)), set("rv", add(mul(mod(v("lv"), 10), 10), floor(div(v("lv"), 10)))),
        ifThen(or(or(lt(v("rv"), 10), eq(v("rv"), v("lv"))), eq(random(1, 3), 1)), [
          set("rv", v("lv")), until(and(not(eq(v("rv"), v("lv"))), and(gt(v("rv"), 9), lt(v("rv"), 100))), [set("rv", add(v("lv"), random(-12, 12)))])]),
        set("lt", v("lv")), set("rt", v("rv"))]],
      // 3: a sum against a number (or another sum).
      [eq(v("mode"), 3), [
        set("a", random(2, 12)), set("b", random(2, 12)), set("lv", add(v("a"), v("b"))), set("lt", join(join(v("a"), "+"), v("b"))),
        set("rv", v("lv")), until(not(eq(v("rv"), v("lv"))), [set("rv", add(v("lv"), random(-3, 3)))]), set("rt", v("rv")),
        ifThen(and(eq(random(1, 2), 1), gt(v("rv"), 5)), [set("a", random(2, sub(v("rv"), 2))), set("rt", join(join(v("a"), "+"), sub(v("rv"), v("a"))))]),
      ]],
      // 4: negative numbers (at least one).
      [eq(v("mode"), 4), [
        set("lv", random(-20, 20)), set("rv", v("lv")), until(not(eq(v("rv"), v("lv"))), [set("rv", random(-20, 20))]),
        ifThen(and(not(lt(v("lv"), 0)), not(lt(v("rv"), 0))), [set("lv", mul(-1, max(1, v("lv"))))]),
        ...compute("lt", [fn("fmt %s", v("lv"))]), ...compute("rt", [fn("fmt %s", v("rv"))]),
      ]],
      // 5: tenths against hundredths (0.5 and 0.45); sometimes the same (0.5 and 0.50).
      [eq(v("mode"), 5), [
        set("a", random(1, 9)), set("b", random(10, 99)), ifThen(eq(random(1, 5), 1), [set("b", mul(v("a"), 10))]),
        set("lv", div(v("a"), 10)), set("lt", join("0.", v("a"))), set("rv", div(v("b"), 100)), set("rt", join("0.", v("b"))),
      ]],
    ], [
      // 6: fractions; sometimes the same (1/2 and 2/4).
      set("a", item("dens", random(1, 6))), set("n", random(1, sub(v("a"), 1))),
      set("lv", div(v("n"), v("a"))), set("lt", join(join(v("n"), "/"), v("a"))),
      ifElse(eq(random(1, 4), 1), [set("k", random(2, 3)), set("rv", v("lv")), set("rt", join(join(mul(v("n"), v("k")), "/"), mul(v("a"), v("k"))))], [
        set("rv", v("lv")),
        until(gt(abs(sub(v("rv"), v("lv"))), 0.0001), [set("b", item("dens", random(1, 6))), set("m", random(1, sub(v("b"), 1))), set("rv", div(v("m"), v("b")))]),
        set("rt", join(join(v("m"), "/"), v("b")))]),
    ]),
    // Either side.
    ifThen(eq(random(1, 2), 1), [set("t", v("lv")), set("lv", v("rv")), set("rv", v("t")), set("t", v("lt")), set("lt", v("rt")), set("rt", v("t"))]),
    // The right choice: 1 left, 2 right, 3 the same.
    cond([[lt(abs(sub(v("lv"), v("rv"))), 0.0001), [set("answer", 3), set("sign", "=")]], [gt(v("lv"), v("rv")), [set("answer", 1), set("sign", ">")]]],
      [set("answer", 2), set("sign", "<")]),
  ], { warp: true, x: 1100, y: 300 });

  define("new pair", [
    ...clear(d, G.cmp),
    call("make pair"),
    set("px", START_X), set("eaten", 0), set("sink", 0),
    ...write(d, { text: v("lt"), x: 0, y: 2, size: 44, group: G.pad + 1, mode: "follow", follow: 1 }),
    ...write(d, { text: v("rt"), x: 0, y: 2, size: 44, group: G.pad + 2, mode: "follow", follow: 2 }),
    ...emit(d, "smoke", -START_X + 30, PAD_Y, 3), ...emit(d, "smoke", START_X - 30, PAD_Y, 3),
    set("state", "come"), set("pairT", 0),
  ], { warp: true, x: 1100, y: 1600 });

  // ---------------------------------------------------------------- one frame of play
  define("play", [
    ifThen(gt(v("eatT"), 0), [change("eatT", -1)]),
    cond([
      [eq(v("state"), "come"), [
        change("px", mul(-1, v("speed"))), change("pairT", 1),
        cond([
          [and(gt(v("pick"), 0), or(lt(v("pick"), 3), eq(v("sameOk"), 1))), [call("judge %s", v("pick"))]],
          [lt(v("px"), TOUCH_X), [call("too slow")]],
        ]),
      ]],
      [eq(v("state"), "eat"), [ifThen(eq(v("eatT"), 0), [
        ifElse(not(lt(v("pairsDone"), v("goal"))), [set("phase", "bonus"), set("state", "none"), broadcast("level done")],
          [set("state", "wait"), set("waitT", 18)])])]],
      [eq(v("state"), "wait"), [change("waitT", -1), ifThen(not(gt(v("waitT"), 0)), [
        ifThen(eq(v("clearBanner"), 1), [...clear(d, G.banner), ...clear(d, G.bannerNum), set("clearBanner", 0)]),
        call("new pair")])]],
    ]),
    call("place pads"),
  ], { warp: true, x: 1700, y: 20 });

  // Where the pads are: drifting in with a bob; the eaten one goes into the gator's mouth; the other one sinks.
  define("place pads", [
    set("s", 1),
    repeat(2, [
      set("dir", 1), ifThen(eq(v("s"), 1), [set("dir", -1)]),
      ifElse(or(eq(v("state"), "come"), eq(v("state"), "eat")), [
        ifElse(eq(v("eaten"), v("s")), [
          replace("slotX", v("s"), add(v("gatorX"), mul(v("dir"), 70))), replace("slotY", v("s"), add(GATOR_Y, 25)),
          replace("padSize", v("s"), max(0, sub(item("padSize", v("s")), 14))),
        ], [
          replace("slotX", v("s"), mul(v("dir"), v("px"))),
          replace("slotY", v("s"), add(add(PAD_Y, mul(3, sin(add(mul(v("frame"), 6), mul(v("s"), 90))))), mul(-1.5, v("sink")))),
          replace("padSize", v("s"), 100),
        ]),
      ], [replace("slotY", v("s"), 9999)]),
      change("s", 1),
    ]),
    ifThen(gt(v("sink"), 0), [change("sink", 1)]),
  ], { warp: true, x: 1700, y: 700 });

  define("judge %s", [
    set("chose", arg("p")),
    // The gator turns to its choice and snaps.
    ifThen(lt(v("chose"), 3), [set("eaten", v("chose")), ...clear(d, add(G.pad, v("chose"))), set("face", 90),
      ifThen(eq(v("chose"), 1), [set("face", -90)]), set("eatT", 24),
      ...emit(d, "debris", mul(add(-1, mul(2, sub(v("chose"), 1))), v("px")), PAD_Y, 8)]),
    ifThen(eq(v("chose"), 3), [set("eatT", 24), set("sink", 1)]),
    // The comparison, written out.
    ...write(d, { text: join(join(join(join(v("lt"), " "), v("sign")), " "), v("rt")), x: 0, y: 40, size: 70, group: G.cmp }),
    pulse(d, G.cmp, 40),
    ifElse(eq(v("chose"), v("answer")), [call("right")], [call("wrong")]),
    set("state", "eat"),
  ], { args: ["p"], warp: true, x: 1700, y: 1300 });

  define("right", [
    change("streak", 1), change("pairsDone", 1), set("gsize", min(115, add(80, mul(5, v("streak"))))),
    set("mult", 1), cond([[gt(v("streak"), 7), [set("mult", 5)]], [gt(v("streak"), 4), [set("mult", 3)]], [gt(v("streak"), 2), [set("mult", 2)]]]),
    set("pts", mul(100, v("level"))),
    ifElse(eq(v("chose"), 3), [...write(d, { text: "word-same", x: 0, y: 95, size: 70, group: G.praise, mode: "float" }),
      ...emit(d, "ring", 0, GATOR_Y, 1)],
      [...write(d, { text: "word-yum", x: mul(add(-1, mul(2, sub(v("chose"), 1))), 120), y: 0, size: 70, group: G.praise, mode: "float" })]),
    // Quick: chosen before the pads were halfway.
    ifThen(gt(v("px"), add(TOUCH_X, div(sub(START_X, TOUCH_X), 2))), [change("pts", 100),
      ...write(d, { text: "word-quick", x: 0, y: 95, size: 50, group: G.quick, mode: "float" })]),
    set("pts", mul(v("pts"), v("mult"))), change("score", v("pts")),
    ...write(d, { text: join("+", v("pts")), x: 0, y: -10, size: 44, group: G.pop, mode: "float" }),
    ...emit(d, "spark", 0, add(GATOR_Y, 20), 12), set("shake", 3),
    ifElse(gt(v("mult"), 1), [
      ...write(d, { text: join("×", v("mult")), x: -82, y: 157, size: 34, group: G.mult }), pulse(d, G.mult, 40)],
      [...clear(d, G.mult)]),
  ], { warp: true, x: 2300, y: 20 });

  define("wrong", [
    set("shake", 9), set("flashKind", "red"), broadcast("flash"),
    ...write(d, { text: "word-oops", x: 0, y: 95, size: 70, group: G.praise, mode: "float" }),
    call("lose heart"),
  ], { warp: true, x: 2300, y: 800 });

  define("too slow", [
    ...clear(d, G.pad + 1), ...clear(d, G.pad + 2), set("sink", 1), set("eatT", 24), set("state", "eat"),
    ...emit(d, "smoke", -TOUCH_X, PAD_Y, 6), ...emit(d, "smoke", TOUCH_X, PAD_Y, 6),
    ...write(d, { text: join(join(join(join(v("lt"), " "), v("sign")), " "), v("rt")), x: 0, y: 40, size: 70, group: G.cmp }),
    ...write(d, { text: "word-slow", x: 0, y: 95, size: 70, group: G.praise, mode: "float" }),
    set("shake", 6), call("lose heart"),
  ], { warp: true, x: 2300, y: 1100 });

  define("lose heart", [
    change("hearts", -1), broadcast("hearts"), set("streak", 0), set("mult", 1), set("gsize", 80), ...clear(d, G.mult),
    ifThen(not(gt(v("hearts"), 0)), [set("phase", "over"), set("state", "none"), broadcast("game over")]),
  ], { warp: true, x: 2300, y: 1400 });

  // ---------------------------------------------------------------- level done, game over
  B.script(whenReceive("level done"), [
    wait(0.4), ...clear(d, G.cmp),
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
    cond([[gt(v("level"), 4), [switchBackdrop("night")]], [gt(v("level"), 2), [switchBackdrop("sunset")]]]),
    set("phase", "play"),
    call("start level"),
  ], 20, 1500);

  B.script(whenReceive("game over"), [
    ...clear(d, G.same),
    ...write(d, { text: "word-gameover", x: 0, y: 95, size: 110, group: G.banner }), pulse(d, G.banner, 40),
    ...write(d, { text: v("score"), x: 0, y: -5, size: 90, group: G.bannerNum }),
    ifThen(gt(v("score"), v("best")), [set("best", v("score")),
      ...write(d, { text: "word-best", x: 0, y: -55, size: 56, group: G.bestWord }), pulse(d, G.bestWord, 50),
      repeat(4, [...emit(d, "confetti", random(-200, 200), 190, 10)])]),
    wait(2),
    ...write(d, { text: "word-clickplay", x: 0, y: 140, size: 44, group: G.click }),
    set("phase", "ready"),
  ], 20, 2300);

  define("roll score", [
    ifThen(and(not(eq(v("shown"), v("score"))), not(eq(v("phase"), "title"))), [
      ifElse(lt(v("shown"), 0), [set("shown", 0)], [change("shown", ceiling(div(sub(v("score"), v("shown")), 6)))]),
      ifThen(gt(v("shown"), v("score")), [set("shown", v("score"))]),
      ...write(d, { text: v("shown"), x: -165, y: 157, size: 46, group: G.score }), pulse(d, G.score, 14),
    ]),
  ], { warp: true, x: 2900, y: 20 });
  return B;
}

// ---------------------------------------------------------------- Gator
function gatorScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, mul, eq, gt, lt, and, ifElse, ifThen, whenFlag, whenReceive, goto, show, costume, point, setSize, sin, random, mod, set, cond } = d;
  B.script(whenFlag(), [d.setRotationStyle("left-right"), point(90), goto(0, GATOR_Y), setSize(100), show(), set("blinkT", 0)], 20, 20);
  B.script(whenReceive("tick"), [
    point(v("face")),
    // It lunges at what it eats; the jaws are open for the first part of a bite.
    set("gatorX", mul(mul(v("face"), 0.45), sin(mul(v("eatT"), 7.5)))),
    goto(add(v("gatorX"), v("shakeX")), add(add(GATOR_Y, mul(2, sin(mul(v("frame"), 4)))), v("shakeY"))),
    setSize(add(v("gsize"), mul(4, sin(mul(v("frame"), 8))))),
    ifThen(eq(mod(v("frame"), 97), 0), [set("blinkT", 6)]),
    cond([
      [gt(v("eatT"), 12), [costume("open")]],
      [gt(v("blinkT"), 0), [costume("blink"), d.change("blinkT", -1)]],
    ], [costume("closed")]),
  ], 20, 120);
  void and; void lt; void random; void ifElse;
  return B;
}

// ---------------------------------------------------------------- Pad: two clones, left and right
function padScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "side");
  const d = dsl(B);
  const { v, add, eq, lt, set, ifThen, ifElse, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, item, costumeTo, setSize, random } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("side", 1), cloneMyself(), set("side", 2), cloneMyself()], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(lt(item("slotY", v("side")), 9000), [
      goto(add(item("slotX", v("side")), v("shakeX")), add(item("slotY", v("side")), v("shakeY"))),
      setSize(item("padSize", v("side"))), show()], [hide()]),
  ])], 20, 240);
  // A new pair: a new flower.
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [ifThen(eq(v("pairT"), 1), [costumeTo(random(1, 3))])])], 20, 400);
  return B;
}

// ---------------------------------------------------------------- Fireflies (at night), Hearts, Flash, Hud
function fireflyScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "fx", "fy", "ph");
  const d = dsl(B);
  const { v, add, mul, eq, gt, set, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, random, sin, cos, setEffect } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), repeat(14, [set("fx", random(-230, 230)), set("fy", random(-10, 120)), set("ph", random(0, 360)), cloneMyself()])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(gt(v("level"), 4), [
      goto(add(v("fx"), mul(30, sin(add(v("ph"), mul(v("frame"), 2))))), add(v("fy"), mul(16, cos(add(v("ph"), mul(v("frame"), 3)))))),
      setEffect("GHOST", add(40, mul(40, sin(add(v("ph"), mul(v("frame"), 9)))))), show()], [hide()]),
  ])], 20, 240);
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
// Any sprite passes its clicks on; the Stage judges them by position.
const clickable = (B: Blocks) => { const d = dsl(B); B.script(d.whenClicked(), [d.broadcast("other click")], 300, 20); return B; };

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Firefly", { blocks: clickable(fireflyScripts()), costumes: A.firefly, layer: 1, visible: false }),
    P.sprite("Pad", { blocks: clickable(padScripts()), costumes: A.pad, layer: 2, visible: false }),
    P.sprite("Gator", { blocks: clickable(gatorScripts()), costumes: A.gator, layer: 3, x: 0, y: GATOR_Y, rotationStyle: "left-right" }),
    P.sprite("Hud", { blocks: clickable(hudScripts()), costumes: A.hud, layer: 4, x: 0, y: 157 }),
    P.sprite("Heart", { blocks: clickable(heartScripts()), costumes: A.heart, layer: 5, visible: false }),
    P.sprite("Spark", { blocks: sparkScripts(P), costumes: sparkCostumes(P), layer: 6, visible: false }),
    P.sprite("Text", { blocks: textScripts(P), costumes: textCostumes(P, "greater-gator"), layer: 7, visible: false }),
    P.sprite("Flash", { blocks: clickable(flashScripts()), costumes: A.flash, layer: 8, visible: false }),
  ],
  listValues: { ...kitLists(), slotX: [0, 0], slotY: [9999, 9999], padSize: [100, 100], dens: [2, 3, 4, 5, 6, 8] },
  shown: [],
});
writeFileSync(new URL("greater-gator.sb3", import.meta.url), sb3);
console.log(`greater-gator.sb3: ${sb3.length} bytes`);
