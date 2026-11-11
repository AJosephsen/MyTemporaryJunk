// Builds shape-builder.sb3: a maths game about turning (angles in degrees, symmetry). A picture is drawn as dashed
// outlines; one piece at a time floats over its outline at the wrong angle. Turn it with the buttons (↺ ↻ 90°, later
// 45°) or the arrow keys and drop it: if it matches the outline it snaps in; if not it bounces back and costs a heart.
// EXACT! is for turning no more degrees than needed; a square already fits after 90°, a rectangle after 180°.
// From level 3 some pieces are "angle calls": pick the turn (90°, 180°, 270°) and watch the piece turn.
//
// The pictures are a record (slot.shape, slot.x, slot.y, slot.dir, slot.col) with picStart/picLen per picture.
// The Stage runs the game once per frame and broadcasts `tick`; the sprites draw from the variables.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { record } from "../../lib/records.ts";
import { textCostumes, textScripts, sparkCostumes, sparkScripts, kitLists, write, clear, pulse, emit } from "../math-kit/kit.ts";
import { art, PICTURES, SHAPES, SHAPE_NAMES } from "./art.ts";

const P = new Project();
type D = ReturnType<typeof dsl>;
export const SLOTS = Math.max(...PICTURES.map(p => p.slots.length));
export const HOVER = 14;
// Buttons: 1 ↺90 2 ↺45 3 DROP 4 ↻45 5 ↻90, and 6..8 the angle-call choices 90°, 180°, 270°.
export const BTN_X = [-170, -85, 0, 85, 170, -110, 0, 110], BTN_Y = -158;
const BTN_TURN = [-90, -45, 0, 45, 90];
const G = { score: 1, mult: 2, levelWord: 3, levelNum: 4, banner: 5, bannerNum: 6, title1: 7, title2: 8, click: 9,
  best: 10, bestWord: 11, pop: 12, turnedWord: 13, turnedNum: 14, praise: 15, bonusWord: 16, quick: 17, label: 30 };  // label b: 30 + b
const slotRecord = (d: D) => record(d, "slot", ["shape", "x", "y", "dir", "col"] as const);

// ---------------------------------------------------------------- Stage: the game
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, or, and, not, join, set, change, ifThen, ifElse, repeat, until, whenFlag,
    whenReceive, forever, broadcast, wait, random, replace, define, call, ceiling, mod, abs, switchBackdrop, item,
    cond, max, min, ret, compute, fn, arg, mouseX, mouseY } = d;
  const slot = slotRecord(d);
  const cur = (f: "shape" | "x" | "y" | "dir" | "col") => slot.get(f, add(v("base"), v("k")));

  B.script(whenFlag(), [
    set("phase", "title"), set("shake", 0), set("frame", 0), set("hideAbove", 400), set("score", 0), set("shown", 0),
    set("hearts", 3), set("level", 1), set("tap", 0), set("btnQ", 0), set("state", "none"), set("k", 0), set("len", 0),
    set("hov", HOVER), set("showDir", 0), set("pdir", 0), set("wiggle", 0),
    switchBackdrop("blueprint"), broadcast("buttons"),
    call("title screen"),
    forever([
      change("frame", 1),
      set("shake", mul(v("shake"), 0.85)), ifThen(lt(v("shake"), 0.4), [set("shake", 0)]),
      set("shakeX", random(mul(v("shake"), -1), v("shake"))), set("shakeY", random(mul(v("shake"), -1), v("shake"))),
      set("press", v("tap")), set("tap", 0), set("btn", v("btnQ")), set("btnQ", 0),
      cond([
        [eq(v("phase"), "play"), [call("play")]],
        [or(eq(v("phase"), "title"), eq(v("phase"), "ready")), [
          replace("groupColor", G.title1, mul(v("frame"), 3)), replace("groupColor", G.title2, mul(v("frame"), 3)),
          ifThen(eq(mod(v("frame"), 20), 0), [pulse(d, G.click, 18)]),
          ifThen(or(eq(v("press"), 1), gt(v("btn"), 0)), [call("new game")]),
        ]],
      ]),
      // The piece turns smoothly to its angle, and floats down when dropped.
      set("showDir", add(v("showDir"), mul(sub(v("pdir"), v("showDir")), 0.3))),
      ifThen(lt(abs(sub(v("pdir"), v("showDir"))), 0.5), [set("showDir", v("pdir"))]),
      ifThen(gt(v("wiggle"), 0), [change("wiggle", -1)]),
      call("roll score"),
      broadcast("tick"),
    ]),
  ], 20, 20);
  // Input: a click on a button (or its label, or anything over it) presses that button; keys too.
  const clickAt = [...compute("hit", [fn("button at mouse")]), ifElse(gt(v("hit"), 0), [set("btnQ", v("hit"))], [set("tap", 1)])];
  B.script(d.whenStageClicked(), clickAt, 20, 900);
  B.script(whenReceive("text click"), clickAt, 20, 980);
  B.script(whenReceive("other click"), clickAt, 20, 1060);
  B.script(d.whenKey("space"), [set("tap", 1), set("btnQ", 3)], 20, 1140);
  B.script(d.whenKey("left arrow"), [ifElse(eq(v("step"), 45), [set("btnQ", 2)], [set("btnQ", 1)])], 20, 1220);
  B.script(d.whenKey("right arrow"), [ifElse(eq(v("step"), 45), [set("btnQ", 4)], [set("btnQ", 5)])], 20, 1300);
  for (const [key, b] of [["1", 6], ["2", 7], ["3", 8]] as const) B.script(d.whenKey(key), [set("btnQ", b)], 20, 1380 + b * 60);
  // The shown button under the mouse, or 0 (a returning custom block).
  define("button at mouse", [
    set("near", 0), set("b", 1),
    repeat(BTN_X.length, [
      ifThen(and(eq(item("btnShow", v("b")), 1), and(lt(abs(sub(mouseX(), item("btnX", v("b")))), 38), lt(abs(sub(mouseY(), BTN_Y)), 20))),
        [set("near", v("b"))]),
      change("b", 1)]),
    ...ret("button at mouse", v("near")),
  ], { warp: true, x: 560, y: 1500 });

  define("title screen", [
    ...write(d, { text: "word-shape1", x: 0, y: 75, size: 120, group: G.title1 }),
    ...write(d, { text: "word-shape2", x: 0, y: 15, size: 130, group: G.title2 }),
    ...write(d, { text: "word-clickplay", x: 0, y: -60, size: 56, group: G.click }),
    ifThen(gt(v("best"), 0), [
      ...write(d, { text: "word-best", x: -40, y: -110, size: 34, group: G.bestWord }),
      ...write(d, { text: v("best"), x: 50, y: -110, size: 40, group: G.best }),
    ]),
  ], { warp: true, x: 560, y: 20 });

  define("new game", [
    ...[G.title1, G.title2, G.click, G.best, G.bestWord, G.banner, G.bannerNum, G.bonusWord, G.mult, G.pop, G.praise, G.quick]
      .flatMap(g => clear(d, g)),
    set("score", 0), set("shown", -1), set("hearts", 3), set("level", 1), set("streak", 0), set("mult", 1), set("picNo", 0),
    broadcast("hearts"), switchBackdrop("blueprint"),
    set("phase", "play"),
    call("start level"),
  ], { warp: true, x: 560, y: 360 });

  define("start level", [
    set("picsDone", 0),
    // Level 1: 90° turns; 2: 45° turns; 3: angle calls; then 45° turns with every other piece an angle call.
    set("step", 90), ifThen(gt(v("level"), 1), [set("step", 45)]),
    set("calls", 0), cond([[eq(v("level"), 3), [set("calls", 1)]], [gt(v("level"), 3), [set("calls", 2)]]]),
    ...write(d, { text: "word-level", x: -175, y: 122, size: 26, group: G.levelWord }),
    ...write(d, { text: v("level"), x: -122, y: 122, size: 32, group: G.levelNum }),
    ...write(d, { text: "word-level", x: -30, y: 40, size: 100, group: G.banner }),
    ...write(d, { text: v("level"), x: 115, y: 40, size: 120, group: G.bannerNum }),
    pulse(d, G.banner, 40), pulse(d, G.bannerNum, 40), set("bannerT", 50),
    call("start picture"),
  ], { warp: true, x: 560, y: 760 });

  define("start picture", [
    change("picNo", 1),
    set("pic", add(mod(sub(v("picNo"), 1), PICTURES.length), 1)),
    set("base", sub(item("picStart", v("pic")), 1)), set("len", item("picLen", v("pic"))),
    set("k", 0), set("mistakes", 0), broadcast("slots"),
    call("next piece"),
  ], { warp: true, x: 560, y: 1150 });

  define("next piece", [
    change("k", 1),
    set("sym", item("shapeSym", cur("shape"))),
    set("isCall", 0), cond([[eq(v("calls"), 1), [set("isCall", 1)]], [eq(v("calls"), 2), [set("isCall", mod(v("k"), 2))]]]),
    // Start at the wrong angle (a square may already fit: then dropping straight away is EXACT).
    ifElse(eq(v("isCall"), 1),
      [set("startDir", sub(cur("dir"), mul(90, random(1, 3))))],
      [set("startDir", add(cur("dir"), mul(v("step"), random(1, sub(div(360, v("step")), 1)))))]),
    set("pdir", v("startDir")), set("showDir", v("startDir")), set("hov", HOVER), set("effort", 0), set("pieceT", 0),
    // The fewest degrees that make it fit, either way round.
    set("m0", mod(sub(cur("dir"), v("startDir")), v("sym"))), set("minimal", min(v("m0"), sub(v("sym"), v("m0")))),
    ifElse(eq(v("isCall"), 1), [set("state", "call")], [set("state", "turn")]),
    call("show buttons"), call("show turned"),
  ], { warp: true, x: 1100, y: 20 });

  define("show buttons", [
    set("b", 1), repeat(BTN_X.length, [replace("btnShow", v("b"), 0), change("b", 1)]),
    ifElse(eq(v("state"), "call"), [replace("btnShow", 6, 1), replace("btnShow", 7, 1), replace("btnShow", 8, 1)], [
      replace("btnShow", 1, 1), replace("btnShow", 3, 1), replace("btnShow", 5, 1),
      ifThen(eq(v("step"), 45), [replace("btnShow", 2, 1), replace("btnShow", 4, 1)])]),
    broadcast("buttons"),
    // Labels on the shown buttons.
    set("b", 1),
    repeat(BTN_X.length, [
      ifElse(eq(item("btnShow", v("b")), 1), [
        cond([
          [eq(v("b"), 3), [...write(d, { text: "word-drop", x: 0, y: BTN_Y, size: 34, group: add(G.label, v("b")) })]],
          [gt(v("b"), 5), [...write(d, { text: join(mul(90, sub(v("b"), 5)), "°"), x: item("btnX", v("b")), y: BTN_Y, size: 34, group: add(G.label, v("b")) })]],
        ], [
          // Turn buttons: the arrow is on one side, the label on the other.
          set("lx", add(item("btnX", v("b")), 9)), ifThen(gt(v("b"), 3), [set("lx", sub(item("btnX", v("b")), 9))]),
          ...write(d, { text: join(abs(item("btnTurn", v("b"))), "°"), x: v("lx"), y: BTN_Y, size: 28, group: add(G.label, v("b")) })]),
      ], [...clear(d, add(G.label, v("b")))]),
      change("b", 1)]),
  ], { warp: true, x: 1100, y: 600 });

  define("show turned", [
    ...write(d, { text: "word-turned", x: -5, y: 157, size: 30, group: G.turnedWord }),
    ...write(d, { text: join(v("effort"), "°"), x: 85, y: 157, size: 42, group: G.turnedNum }),
  ], { warp: true, x: 1100, y: 1200 });

  // ---------------------------------------------------------------- one frame of play
  define("play", [
    ifThen(gt(v("bannerT"), 0), [change("bannerT", -1), ifThen(eq(v("bannerT"), 0), [...clear(d, G.banner), ...clear(d, G.bannerNum)])]),
    change("pieceT", 1),
    cond([
      [eq(v("state"), "turn"), [
        set("hov", min(HOVER, add(v("hov"), 3))),
        cond([
          [eq(v("btn"), 3), [set("state", "drop")]],
          [and(gt(v("btn"), 0), lt(v("btn"), 6)), [
            ifThen(eq(item("btnShow", v("btn")), 1), [
              change("pdir", item("btnTurn", v("btn"))), change("effort", abs(item("btnTurn", v("btn")))),
              call("show turned"), pulse(d, G.turnedNum, 30)])]],
        ]),
      ]],
      [eq(v("state"), "call"), [
        set("hov", min(HOVER, add(v("hov"), 3))),
        ifThen(gt(v("btn"), 5), [set("effort", mul(90, sub(v("btn"), 5))), change("pdir", v("effort")), call("show turned"),
          set("state", "spin")]),
      ]],
      // The piece turns to the called angle, then drops.
      [eq(v("state"), "spin"), [ifThen(eq(v("showDir"), v("pdir")), [set("state", "drop")])]],
      [eq(v("state"), "drop"), [change("hov", -3), ifThen(not(gt(v("hov"), 0)), [set("hov", 0), call("check fit")])]],
      [eq(v("state"), "bounce"), [change("hov", 4), ifThen(not(lt(v("hov"), HOVER)), [
        // After a wrong angle call the piece turns back to where it started.
        ifElse(eq(v("isCall"), 1), [set("pdir", v("startDir")), set("state", "call")], [set("state", "turn")])])]],
      [eq(v("state"), "done"), [change("doneT", -1), ifThen(not(gt(v("doneT"), 0)), [call("picture done")])]],
    ]),
  ], { warp: true, x: 1700, y: 20 });

  define("check fit", [
    ifElse(eq(mod(sub(v("pdir"), cur("dir")), v("sym")), 0), [call("fits")], [
      // Wrong angle: bounce, a heart, try again.
      set("state", "bounce"), set("shake", 8), set("flashKind", "red"), broadcast("flash"), change("mistakes", 1),
      ...write(d, { text: "word-oops", x: cur("x"), y: add(cur("y"), 50), size: 64, group: G.praise, mode: "float" }),
      change("hearts", -1), broadcast("hearts"), set("streak", 0), set("mult", 1), ...clear(d, G.mult),
      ifThen(not(gt(v("hearts"), 0)), [set("phase", "over"), set("state", "none"), broadcast("game over")]),
    ]),
  ], { warp: true, x: 1700, y: 800 });

  define("fits", [
    ...emit(d, "spark", cur("x"), cur("y"), 14), ...emit(d, "ring", cur("x"), cur("y"), 1), set("shake", 3),
    change("streak", 1),
    set("mult", 1), cond([[gt(v("streak"), 7), [set("mult", 5)]], [gt(v("streak"), 4), [set("mult", 3)]], [gt(v("streak"), 2), [set("mult", 2)]]]),
    set("pts", mul(100, v("level"))),
    // EXACT: no more degrees than needed (not for angle calls: there the turn is chosen, not counted).
    ifThen(and(eq(v("isCall"), 0), eq(v("effort"), v("minimal"))), [change("pts", 150),
      ...write(d, { text: "word-exact", x: cur("x"), y: add(cur("y"), 55), size: 60, group: G.praise, mode: "float" })]),
    ifThen(lt(v("pieceT"), 100), [change("pts", 100),
      ...write(d, { text: "word-quick", x: cur("x"), y: add(cur("y"), 20), size: 48, group: G.quick, mode: "float" })]),
    set("pts", mul(v("pts"), v("mult"))), change("score", v("pts")),
    ...write(d, { text: join("+", v("pts")), x: cur("x"), y: sub(cur("y"), 25), size: 40, group: G.pop, mode: "float" }),
    ifElse(gt(v("mult"), 1), [
      ...write(d, { text: join("×", v("mult")), x: -82, y: 157, size: 34, group: G.mult }), pulse(d, G.mult, 40)],
      [...clear(d, G.mult)]),
    broadcast("slots"),
    ifElse(lt(v("k"), v("len")), [call("next piece"), broadcast("slots")], [
      // The picture is done: it wiggles, then a bonus.
      change("k", 1), broadcast("slots"), set("state", "done"), set("doneT", 70), set("wiggle", 60), set("bannerT", 0),
      set("b", 1), repeat(BTN_X.length, [replace("btnShow", v("b"), 0), ...clear(d, add(G.label, v("b"))), change("b", 1)]), broadcast("buttons"),
      repeat(4, [...emit(d, "confetti", random(-200, 200), 150, 10)]),
      ifElse(eq(v("mistakes"), 0), [
        ...write(d, { text: "word-perfect", x: 0, y: 40, size: 100, group: G.banner }), set("bonus", mul(500, v("level")))], [
        ...write(d, { text: "word-great", x: 0, y: 40, size: 100, group: G.banner }), set("bonus", mul(150, v("level")))]),
      pulse(d, G.banner, 50), set("flashKind", "white"), broadcast("flash"),
      ...write(d, { text: join("+", v("bonus")), x: 0, y: -20, size: 70, group: G.bannerNum }), pulse(d, G.bannerNum, 50),
      change("score", v("bonus")),
    ]),
  ], { warp: true, x: 2300, y: 20 });

  define("picture done", [
    ...clear(d, G.banner), ...clear(d, G.bannerNum),
    change("picsDone", 1),
    ifElse(lt(v("picsDone"), 2), [call("start picture")], [set("phase", "bonus"), set("state", "none"), broadcast("level done")]),
  ], { warp: true, x: 2300, y: 1300 });

  // ---------------------------------------------------------------- level done, game over
  B.script(whenReceive("level done"), [
    ...write(d, { text: "word-levelup", x: 0, y: 60, size: 110, group: G.banner }), pulse(d, G.banner, 50),
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
    cond([[eq(mod(v("level"), 3), 2), [switchBackdrop("night")]], [eq(mod(v("level"), 3), 0), [switchBackdrop("sunset")]]], [switchBackdrop("blueprint")]),
    set("phase", "play"),
    call("start level"),
  ], 20, 1700);

  B.script(whenReceive("game over"), [
    set("b", 1), repeat(BTN_X.length, [replace("btnShow", v("b"), 0), ...clear(d, add(G.label, v("b"))), change("b", 1)]), broadcast("buttons"),
    ...clear(d, G.turnedWord), ...clear(d, G.turnedNum),
    set("shake", 12),
    ...write(d, { text: "word-gameover", x: 0, y: 80, size: 110, group: G.banner }), pulse(d, G.banner, 40),
    ...write(d, { text: v("score"), x: 0, y: 10, size: 100, group: G.bannerNum }),
    ifThen(gt(v("score"), v("best")), [set("best", v("score")),
      ...write(d, { text: "word-best", x: 0, y: -45, size: 60, group: G.bestWord }), pulse(d, G.bestWord, 50),
      repeat(4, [...emit(d, "confetti", random(-200, 200), 190, 10)])]),
    wait(2),
    ...write(d, { text: "word-clickplay", x: 0, y: -100, size: 56, group: G.click }),
    set("len", 0), broadcast("slots"),
    set("phase", "ready"),
  ], 20, 2300);

  define("roll score", [
    ifThen(and(not(eq(v("shown"), v("score"))), not(eq(v("phase"), "title"))), [
      ifElse(lt(v("shown"), 0), [set("shown", 0)], [change("shown", ceiling(div(sub(v("score"), v("shown")), 6)))]),
      ifThen(gt(v("shown"), v("score")), [set("shown", v("score"))]),
      ...write(d, { text: v("shown"), x: -165, y: 157, size: 46, group: G.score }), pulse(d, G.score, 14),
    ]),
  ], { warp: true, x: 2900, y: 20 });
  void arg;
  return B;
}

// ---------------------------------------------------------------- Slot: one clone per slot of the picture
function slotScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "j");
  const d = dsl(B);
  const { v, add, sub, mul, eq, lt, gt, and, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show,
    goto, cloneMyself, item, costumeTo, join, setEffect, point, sin, not } = d;
  const slot = slotRecord(d);
  const my = (f: "shape" | "x" | "y" | "dir" | "col") => slot.get(f, add(v("base"), v("j")));
  B.script(whenFlag(), [hide(), set("isClone", 0), set("j", 1), repeat(SLOTS, [cloneMyself(), change("j", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  // Placed pieces are filled and coloured; the rest are dashed outlines (the next one glows).
  B.script(whenReceive("slots"), [ifThen(eq(v("isClone"), 1), [
    ifElse(gt(v("j"), v("len")), [hide()], [
      ifElse(lt(v("j"), v("k")), [costumeTo(item("shapeNames", my("shape"))), setEffect("COLOR", my("col")), setEffect("BRIGHTNESS", 0)],
        [costumeTo(join("o-", item("shapeNames", my("shape")))), setEffect("COLOR", 0)]),
      point(add(90, my("dir"))), show(),
    ]),
  ])], 20, 240);
  B.script(whenReceive("tick"), [ifThen(and(eq(v("isClone"), 1), not(gt(v("j"), v("len")))), [
    // A finished picture wiggles; the outline to fill next pulses.
    goto(add(my("x"), v("shakeX")), add(add(my("y"), v("shakeY")), mul(v("wiggle"), mul(0.12, sin(add(mul(v("frame"), 25), mul(v("j"), 50))))))),
    ifThen(eq(v("j"), v("k")), [setEffect("BRIGHTNESS", mul(25, sin(mul(v("frame"), 12))))]),
  ])], 20, 420);
  void sub;
  return B;
}

// ---------------------------------------------------------------- Piece (the one you turn) and its Shadow
function pieceScripts(shadow: boolean): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, eq, or, set, ifElse, whenFlag, whenReceive, hide, show, goto, item, costumeTo, join, setEffect, point, sin, setSize } = d;
  const slot = slotRecord(d);
  const cur = (f: "shape" | "x" | "y" | "dir" | "col") => slot.get(f, add(v("base"), v("k")));
  B.script(whenFlag(), [hide()], 20, 20);
  const active = or(or(eq(v("state"), "turn"), eq(v("state"), "call")), or(or(eq(v("state"), "spin"), eq(v("state"), "drop")), eq(v("state"), "bounce")));
  B.script(whenReceive("tick"), [
    ifElse(active, [
      // It floats (bobbing a little) while you turn it, and lands on the outline when dropped.
      set(shadow ? "sh" : "ph", add(v("hov"), mul(div(v("hov"), HOVER), mul(3, sin(mul(v("frame"), 8)))))),
      shadow
        ? costumeTo(join("s-", item("shapeNames", cur("shape"))))
        : costumeTo(item("shapeNames", cur("shape"))),
      ...(shadow ? [] : [setEffect("COLOR", cur("col"))]),
      point(add(90, v("showDir"))), setSize(add(100, mul(0.5, v(shadow ? "sh" : "ph")))),
      shadow
        ? goto(add(add(cur("x"), mul(0.5, v("sh"))), v("shakeX")), add(sub(cur("y"), mul(0.5, v("sh"))), v("shakeY")))
        : goto(add(cur("x"), v("shakeX")), add(add(cur("y"), v("ph")), v("shakeY"))),
      show(),
    ], [hide()]),
  ], 20, 100);
  return B;
  function div(a: any, b: any) { return d.div(a, b); }
}

// ---------------------------------------------------------------- Buttons: one clone each
function buttonScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "b");
  const d = dsl(B);
  const { v, eq, gt, lt, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, whenClicked, hide, show, goto,
    cloneMyself, item, costume, setSize, size, changeSize, cond } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("b", 1), repeat(BTN_X.length, [cloneMyself(), change("b", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), goto(item("btnX", v("b")), BTN_Y),
    cond([[lt(v("b"), 3), [costume("ccw")]], [eq(v("b"), 3), [costume("drop")]], [lt(v("b"), 6), [costume("cw")]]], [costume("choice")])], 20, 160);
  B.script(whenReceive("buttons"), [ifThen(eq(v("isClone"), 1), [ifElse(eq(item("btnShow", v("b")), 1), [show()], [hide()])])], 20, 300);
  B.script(whenClicked(), [ifThen(eq(v("isClone"), 1), [set("btnQ", v("b")), setSize(115)])], 20, 380);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [ifThen(gt(size(), 100), [changeSize(-3)])])], 20, 460);
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
// A click on any other sprite (the flash covers everything for a moment) also looks for the button under the mouse.
const clickable = (B: Blocks) => { const d = dsl(B); B.script(d.whenClicked(), [d.broadcast("other click")], 300, 20); return B; };

// The pictures as one table, and where each picture starts in it.
const flat = PICTURES.flatMap(p => p.slots);
const picStart = PICTURES.map((_, i) => PICTURES.slice(0, i).reduce((n, p) => n + p.slots.length, 0) + 1);

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Slot", { blocks: clickable(slotScripts()), costumes: A.shape, layer: 1, visible: false }),
    P.sprite("Shadow", { blocks: clickable(pieceScripts(true)), costumes: A.shape, layer: 2, visible: false }),
    P.sprite("Piece", { blocks: clickable(pieceScripts(false)), costumes: A.shape, layer: 3, visible: false }),
    P.sprite("Button", { blocks: buttonScripts(), costumes: A.button, layer: 4, visible: false }),
    P.sprite("Hud", { blocks: clickable(hudScripts()), costumes: A.hud, layer: 5, x: 0, y: 157 }),
    P.sprite("Heart", { blocks: clickable(heartScripts()), costumes: A.heart, layer: 6, visible: false }),
    P.sprite("Spark", { blocks: sparkScripts(P), costumes: sparkCostumes(P), layer: 7, visible: false }),
    P.sprite("Text", { blocks: textScripts(P), costumes: textCostumes(P, "shape-builder"), layer: 8, visible: false }),
    P.sprite("Flash", { blocks: clickable(flashScripts()), costumes: A.flash, layer: 9, visible: false }),
  ],
  listValues: {
    ...kitLists(),
    "slot.shape": flat.map(s => SHAPE_NAMES.indexOf(s[0]) + 1), "slot.x": flat.map(s => s[1]), "slot.y": flat.map(s => s[2]),
    "slot.dir": flat.map(s => s[3]), "slot.col": flat.map(s => s[4]),
    picStart, picLen: PICTURES.map(p => p.slots.length),
    shapeNames: SHAPE_NAMES, shapeSym: SHAPE_NAMES.map(n => SHAPES[n].sym),
    btnX: BTN_X, btnTurn: [...BTN_TURN, 0, 0, 0], btnShow: BTN_X.map(() => 0),
  },
  shown: [],
});
writeFileSync(new URL("shape-builder.sb3", import.meta.url), sb3);
console.log(`shape-builder.sb3: ${sb3.length} bytes`);
