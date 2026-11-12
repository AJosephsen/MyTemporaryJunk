// Builds number-line-jumper.sb3: a maths game on the number line. A frog sits on a line of lily pads; a sign shows a
// jump (+3, −5, later +4 −7, or jumps in 2s, 5s, 10s). Click the pad where the frog will land (or ← → and Space).
// The frog hops there pad by pad, counting. A wrong pad or running out of time costs a heart, but the frog still hops
// to the right pad, which glows, so you see the answer. Flies on a pad are a bonus when the frog lands on them.
//
// The number line is a ring of WIN pad slots: slot j shows the pad index v with v ≡ j (mod WIN) inside the window
// around the camera, so scrolling only rewrites the label of a slot that moved to a new number. A pad index v has the
// label v × unit (unit is 1, 2, 5 or 10).
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { textCostumes, textScripts, sparkCostumes, sparkScripts, kitLists, write, clear, pulse, emit } from "../math-kit/kit.ts";
import { art } from "./art.ts";

const P = new Project();
export const WIN = 15, HALF = 7, SP = 32, PAD_Y = -70, HOPF = 9, FLIES = 2, BEADS = 10;
const BAND = [-115, -30];   // clicks between these y values are on the number line
const G = { score: 1, mult: 2, levelWord: 3, levelNum: 4, banner: 5, bannerNum: 6, title1: 7, title2: 8, click: 9,
  best: 10, bestWord: 11, pop: 12, card: 13, praise: 14, bonusWord: 15, quick: 16, count: 17, pad: 20 };   // pad slot j: 20 + j

// ---------------------------------------------------------------- Stage: the game
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, or, and, not, join, set, change, ifThen, ifElse, repeat, until, whenFlag,
    whenReceive, forever, broadcast, wait, random, replace, define, call, ceiling, round, mod, abs, sin, switchBackdrop,
    arg, cond, max, min, ret, compute, fn, mouseX, mouseY, item } = d;

  B.script(whenFlag(), [
    set("phase", "title"), set("shake", 0), set("frame", 0), set("hideAbove", 400), set("score", 0), set("shown", 0),
    set("hearts", 3), set("level", 1), set("tap", 0), set("pickQ", 0), set("pickIdx", 0), set("curQ", 0), set("state", "none"),
    set("fi", 0), set("fpos", 0), set("cam", 0), set("unit", 1), set("cur", 0), set("face", 90), set("hopT", 0), set("hopDir", 1),
    set("showRight", 0), set("showWrong", 0), set("timeLeft", 0), set("timeTotal", 1),
    set("j", 1), repeat(WIN, [replace("padLab", v("j"), "?"), change("j", 1)]),
    switchBackdrop("morning"),
    call("title screen"),
    forever([
      change("frame", 1),
      set("shake", mul(v("shake"), 0.85)), ifThen(lt(v("shake"), 0.4), [set("shake", 0)]),
      set("shakeX", random(mul(v("shake"), -1), v("shake"))), set("shakeY", random(mul(v("shake"), -1), v("shake"))),
      set("press", v("tap")), set("tap", 0), set("pick", v("pickQ")), set("pickQ", 0), set("curMove", v("curQ")), set("curQ", 0),
      cond([
        [eq(v("phase"), "play"), [call("play")]],
        [or(eq(v("phase"), "title"), eq(v("phase"), "ready")), [
          replace("groupColor", G.title1, mul(v("frame"), 3)), replace("groupColor", G.title2, mul(v("frame"), 3)),
          ifThen(eq(mod(v("frame"), 20), 0), [pulse(d, G.click, 18)]),
          ifThen(or(eq(v("press"), 1), eq(v("pick"), 1)), [call("new game")]),
        ]],
      ]),
      call("camera"),
      call("roll score"),
      broadcast("tick"),
    ]),
  ], 20, 20);
  // Input: a click on the number line picks the pad under it; anywhere else it is a plain tap. Keys move a cursor.
  const clickAt = [set("tap", 1), ifThen(and(gt(mouseY(), BAND[0]), lt(mouseY(), BAND[1])),
    [set("pickIdx", round(add(div(mouseX(), SP), v("cam")))), set("pickQ", 1)])];
  B.script(d.whenStageClicked(), clickAt, 20, 900);
  B.script(whenReceive("text click"), clickAt, 20, 1000);
  B.script(whenReceive("other click"), clickAt, 20, 1100);
  B.script(d.whenKey("left arrow"), [set("curQ", -1)], 20, 1200);
  B.script(d.whenKey("right arrow"), [set("curQ", 1)], 20, 1260);
  B.script(d.whenKey("space"), [set("tap", 1), set("pickIdx", v("cur")), set("pickQ", 1)], 20, 1320);

  define("title screen", [
    ...write(d, { text: "word-line1", x: 0, y: 95, size: 100, group: G.title1 }),
    ...write(d, { text: "word-line2", x: 0, y: 38, size: 130, group: G.title2 }),
    ...write(d, { text: "word-clickplay", x: 0, y: -15, size: 50, group: G.click }),
    ifThen(gt(v("best"), 0), [
      ...write(d, { text: "word-best", x: -40, y: 157, size: 34, group: G.bestWord }),
      ...write(d, { text: v("best"), x: 50, y: 157, size: 40, group: G.best }),
    ]),
  ], { warp: true, x: 560, y: 20 });

  define("new game", [
    ...[G.title1, G.title2, G.click, G.best, G.bestWord, G.banner, G.bannerNum, G.bonusWord, G.mult, G.pop, G.praise, G.quick, G.count]
      .flatMap(g => clear(d, g)),
    set("score", 0), set("shown", -1), set("hearts", 3), set("level", 1), set("streak", 0), set("mult", 1),
    broadcast("hearts"), switchBackdrop("morning"),
    set("phase", "play"),
    call("start level"),
  ], { warp: true, x: 560, y: 360 });

  define("start level", [
    set("jumpsDone", 0), set("goal", 8), set("fi", 0), set("fpos", 0),
    set("mode", v("level")), set("unit", 1),
    cond([[eq(v("level"), 5), [set("unit", 2)]], [eq(v("level"), 6), [set("unit", 5)]], [eq(v("level"), 7), [set("unit", 10)]]]),
    set("timeTotal", max(110, sub(300, mul(25, v("level"))))),
    ...write(d, { text: "word-level", x: -175, y: 122, size: 26, group: G.levelWord }),
    ...write(d, { text: v("level"), x: -122, y: 122, size: 32, group: G.levelNum }),
    ...write(d, { text: "word-level", x: -30, y: 40, size: 100, group: G.banner }),
    ...write(d, { text: v("level"), x: 115, y: 40, size: 120, group: G.bannerNum }),
    pulse(d, G.banner, 40), pulse(d, G.bannerNum, 40), set("clearBanner", 1),
    ...clear(d, G.card),
    set("state", "pause"), set("pauseT", 50),
  ], { warp: true, x: 560, y: 760 });

  // ---------------------------------------------------------------- questions
  // A number as text with a proper minus sign; signed: +3 or −3.
  define("fmt %s", [ifElse(lt(arg("n"), 0), ret("fmt %s", join("−", abs(arg("n")))), ret("fmt %s", arg("n")))],
    { args: ["n"], warp: true, x: 1100, y: 20 });
  define("signed %s", [ifElse(lt(arg("n"), 0), ret("signed %s", join("−", abs(arg("n")))), ret("signed %s", join("+", arg("n"))))],
    { args: ["n"], warp: true, x: 1100, y: 200 });

  define("new question", [
    ifThen(gt(v("level"), 7), [set("mode", random(1, 7)), set("unit", 1),
      cond([[eq(v("mode"), 5), [set("unit", 2)]], [eq(v("mode"), 6), [set("unit", 5)]], [eq(v("mode"), 7), [set("unit", 10)]]])]),
    cond([
      // 1: forward only.
      [eq(v("mode"), 1), [set("total", random(1, 5)), ...compute("card", [fn("signed %s", mul(v("total"), v("unit")))])]],
      // 4: two jumps in one (+4 −7): the frog lands where both take it.
      [eq(v("mode"), 4), [
        set("total", 0),
        until(and(not(eq(v("total"), 0)), and(not(gt(abs(v("total")), HALF)), not(gt(abs(add(v("fi"), v("total"))), 12)))), [
          set("j1", mul(random(1, 5), item("signs", random(1, 2)))), set("j2", mul(random(1, 6), item("signs", random(1, 2)))),
          set("total", add(v("j1"), v("j2")))]),
        ...compute("card", [fn("signed %s", v("j1")), fn("signed %s", v("j2"))], (a, b) => join(join(a, " "), b)),
      ]],
    ], [
      // 2: back and forth, staying at 0 or above; 3, 5, 6, 7: across zero, within ±12 pads.
      set("most", 6), ifThen(eq(v("mode"), 2), [set("most", 5)]),
      set("total", mul(random(1, v("most")), item("signs", random(1, 2)))),
      ifThen(and(eq(v("mode"), 2), lt(add(v("fi"), v("total")), 0)), [set("total", mul(-1, v("total")))]),
      ifThen(and(gt(v("mode"), 2), gt(abs(add(v("fi"), v("total"))), 12)), [set("total", mul(-1, v("total")))]),
      ...compute("card", [fn("signed %s", mul(v("total"), v("unit")))]),
    ]),
    set("target", add(v("fi"), v("total"))),
    ...write(d, { text: v("card"), x: 0, y: 92, size: 64, group: G.card }), pulse(d, G.card, 40),
    set("timeLeft", v("timeTotal")), set("cur", v("fi")), set("state", "ask"),
  ], { warp: true, x: 1100, y: 400 });

  // ---------------------------------------------------------------- one frame of play
  define("play", [
    cond([
      [eq(v("state"), "ask"), [
        change("timeLeft", -1),
        // The cursor follows the mouse over the number line, or the arrow keys.
        ifThen(and(gt(mouseY(), BAND[0]), lt(mouseY(), BAND[1])), [set("cur", round(add(div(mouseX(), SP), v("cam"))))]),
        change("cur", v("curMove")),
        set("cur", max(sub(v("fi"), HALF), min(add(v("fi"), HALF), v("cur")))),
        cond([
          [eq(v("pick"), 1), [call("judge %s", v("pickIdx"))]],
          [not(gt(v("timeLeft"), 0)), [call("too slow")]],
        ]),
      ]],
      [eq(v("state"), "hop"), [
        change("hopT", 1), set("fpos", add(v("fi"), mul(v("hopDir"), div(v("hopT"), HOPF)))),
        ifThen(not(lt(v("hopT"), HOPF)), [
          change("fi", v("hopDir")), set("fpos", v("fi")), set("hopT", 0), change("hopsLeft", -1), change("hopNo", 1),
          // It counts its hops.
          ...write(d, { text: v("hopNo"), x: mul(sub(v("fi"), v("cam")), SP), y: add(PAD_Y, 48), size: 34, group: G.count, mode: "float" }),
          ...emit(d, "spark", mul(sub(v("fi"), v("cam")), SP), PAD_Y, 2),
          ifThen(eq(v("hopsLeft"), 0), [call("landed")]),
        ]),
      ]],
      [eq(v("state"), "pause"), [change("pauseT", -1), ifThen(not(gt(v("pauseT"), 0)), [
        ifThen(eq(v("clearBanner"), 1), [...clear(d, G.banner), ...clear(d, G.bannerNum), set("clearBanner", 0)]),
        call("new question")])]],
    ]),
  ], { warp: true, x: 1700, y: 20 });

  define("judge %s", [
    set("chose", arg("p")), set("showRight", 1),
    ifElse(eq(v("chose"), v("target")), [call("right")], [set("showWrong", 1), call("wrong")]),
    ifThen(gt(v("hearts"), 0), [call("start hops")]),
  ], { args: ["p"], warp: true, x: 1700, y: 900 });

  define("start hops", [
    set("hopsLeft", abs(sub(v("target"), v("fi")))), set("hopDir", 1), ifThen(lt(v("target"), v("fi")), [set("hopDir", -1)]),
    set("face", mul(90, v("hopDir"))), set("hopT", 0), set("hopNo", 0), set("state", "hop"),
    set("wasRight", 0), ifThen(eq(v("chose"), v("target")), [set("wasRight", 1)]),
  ], { warp: true, x: 1700, y: 1200 });

  define("right", [
    change("streak", 1), change("jumpsDone", 1),
    set("mult", 1), cond([[gt(v("streak"), 7), [set("mult", 5)]], [gt(v("streak"), 4), [set("mult", 3)]], [gt(v("streak"), 2), [set("mult", 2)]]]),
    set("pts", mul(100, v("level"))),
    ifThen(gt(v("timeLeft"), mul(0.6, v("timeTotal"))), [change("pts", 100),
      ...write(d, { text: "word-quick", x: 0, y: 40, size: 50, group: G.quick, mode: "float" })]),
    set("pts", mul(v("pts"), v("mult"))), change("score", v("pts")),
    ...write(d, { text: join("+", v("pts")), x: mul(sub(v("target"), v("cam")), SP), y: add(PAD_Y, 75), size: 40, group: G.pop, mode: "float" }),
    ifElse(gt(v("mult"), 1), [
      ...write(d, { text: join("×", v("mult")), x: -82, y: 157, size: 34, group: G.mult }), pulse(d, G.mult, 40)],
      [...clear(d, G.mult)]),
  ], { warp: true, x: 2300, y: 20 });

  define("wrong", [
    set("shake", 8), set("flashKind", "red"), broadcast("flash"),
    ...write(d, { text: "word-oops", x: 0, y: 40, size: 70, group: G.praise, mode: "float" }),
    call("lose heart"),
  ], { warp: true, x: 2300, y: 700 });

  define("too slow", [
    set("chose", "none"), set("showRight", 1), set("shake", 6),
    ...write(d, { text: "word-slow", x: 0, y: 40, size: 70, group: G.praise, mode: "float" }),
    call("lose heart"),
    ifThen(gt(v("hearts"), 0), [call("start hops")]),
  ], { warp: true, x: 2300, y: 950 });

  define("lose heart", [
    change("hearts", -1), broadcast("hearts"), set("streak", 0), set("mult", 1), ...clear(d, G.mult),
    ifThen(not(gt(v("hearts"), 0)), [set("phase", "over"), set("state", "none"), broadcast("game over")]),
  ], { warp: true, x: 2300, y: 1250 });

  define("landed", [
    set("showRight", 0), set("showWrong", 0), set("face", 90),
    ...emit(d, "ring", mul(sub(v("fi"), v("cam")), SP), PAD_Y, 1),
    // A fly on this pad: a bonus (only for a right answer).
    set("k", 1), repeat(FLIES, [
      ifThen(eq(item("flyIdx", v("k")), v("fi")), [
        ifThen(eq(v("wasRight"), 1), [set("bonusFly", mul(250, v("level"))), change("score", v("bonusFly")),
          ...write(d, { text: "word-yum", x: mul(sub(v("fi"), v("cam")), SP), y: add(PAD_Y, 100), size: 60, group: G.bonusWord, mode: "float" }),
          ...emit(d, "spark", mul(sub(v("fi"), v("cam")), SP), add(PAD_Y, 30), 12)]),
        replace("flyIdx", v("k"), add(v("fi"), mul(random(2, 6), item("signs", random(1, 2)))))]),
      change("k", 1)]),
    ifElse(not(lt(v("jumpsDone"), v("goal"))), [set("phase", "bonus"), set("state", "none"), ...clear(d, G.card), broadcast("level done")],
      [set("state", "pause"), set("pauseT", 14)]),
  ], { warp: true, x: 2300, y: 1500 });

  // ---------------------------------------------------------------- camera: pads, labels, the frog and flies
  define("camera", [
    set("cam", add(v("cam"), mul(sub(v("fpos"), v("cam")), 0.12))),
    set("c", round(v("cam"))),
    set("j", 1),
    repeat(WIN, [
      // The pad index in this slot, inside the window around the camera.
      set("pv", add(sub(v("c"), HALF), mod(sub(v("j"), sub(v("c"), HALF)), WIN))),
      replace("padIdx", v("j"), v("pv")),
      replace("slotX", v("j"), mul(sub(v("pv"), v("cam")), SP)), replace("slotY", v("j"), PAD_Y),
      // Rewrite the label only when this slot shows a new number.
      set("lab", mul(v("pv"), v("unit"))),
      ifThen(not(eq(item("padLab", v("j")), v("lab"))), [
        replace("padLab", v("j"), v("lab")), ...compute("labT", [fn("fmt %s", v("lab"))]),
        ...write(d, { text: v("labT"), x: 0, y: -22, size: 26, group: add(G.pad, v("j")), mode: "follow", follow: v("j") })]),
      change("j", 1),
    ]),
    // Flies that drift out of the window come back near the frog.
    set("k", 1), repeat(FLIES, [
      ifThen(gt(abs(sub(item("flyIdx", v("k")), v("cam"))), sub(HALF, 1)), [
        replace("flyIdx", v("k"), add(v("fi"), mul(random(2, 6), item("signs", random(1, 2)))))]),
      change("k", 1)]),
  ], { warp: true, x: 2900, y: 20 });

  // ---------------------------------------------------------------- level done, game over
  B.script(whenReceive("level done"), [
    wait(0.3),
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
    cond([[gt(v("level"), 5), [switchBackdrop("dusk")]], [gt(v("level"), 2), [switchBackdrop("afternoon")]]]),
    set("phase", "play"),
    call("start level"),
  ], 20, 1500);

  B.script(whenReceive("game over"), [
    ...clear(d, G.card),
    ...write(d, { text: "word-gameover", x: 0, y: 95, size: 110, group: G.banner }), pulse(d, G.banner, 40),
    ...write(d, { text: v("score"), x: 0, y: 25, size: 90, group: G.bannerNum }),
    ifThen(gt(v("score"), v("best")), [set("best", v("score")),
      ...write(d, { text: "word-best", x: 0, y: -20, size: 56, group: G.bestWord }), pulse(d, G.bestWord, 50),
      repeat(4, [...emit(d, "confetti", random(-200, 200), 190, 10)])]),
    wait(2),
    ...write(d, { text: "word-clickplay", x: 0, y: -140, size: 44, group: G.click }),
    set("phase", "ready"),
  ], 20, 2300);

  define("roll score", [
    ifThen(and(not(eq(v("shown"), v("score"))), not(eq(v("phase"), "title"))), [
      ifElse(lt(v("shown"), 0), [set("shown", 0)], [change("shown", ceiling(div(sub(v("score"), v("shown")), 6)))]),
      ifThen(gt(v("shown"), v("score")), [set("shown", v("score"))]),
      ...write(d, { text: v("shown"), x: -165, y: 157, size: 46, group: G.score }), pulse(d, G.score, 14),
    ]),
  ], { warp: true, x: 2900, y: 900 });
  void sin;
  return B;
}

// ---------------------------------------------------------------- Pad: one clone per ring slot
function padScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "j");
  const d = dsl(B);
  const { v, add, eq, set, change, ifThen, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, item } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("j", 1), repeat(WIN, [cloneMyself(), change("j", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), show()], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    goto(add(item("slotX", v("j")), v("shakeX")), add(item("slotY", v("j")), v("shakeY")))])], 20, 240);
  return B;
}

// ---------------------------------------------------------------- Frog
function frogScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, gt, ifElse, whenFlag, whenReceive, goto, show, costume, point, sin } = d;
  B.script(whenFlag(), [d.setRotationStyle("left-right"), point(90), costume("sit"), show()], 20, 20);
  B.script(whenReceive("tick"), [
    point(v("face")),
    // A hop is an arc from pad to pad.
    ifElse(eq(v("state"), "hop"), [costume("leap"),
      goto(add(mul(sub(v("fpos"), v("cam")), SP), v("shakeX")), add(add(PAD_Y + 4, mul(20, sin(mul(div(v("hopT"), HOPF), 180)))), v("shakeY")))], [
      costume("sit"),
      goto(add(mul(sub(v("fpos"), v("cam")), SP), v("shakeX")), add(add(PAD_Y + 4, mul(1.5, sin(mul(v("frame"), 6)))), v("shakeY")))]),
  ], 20, 120);
  void gt;
  return B;
}

// ---------------------------------------------------------------- Rings: the cursor, the right pad, the wrong pad
function ringScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "kind");
  const d = dsl(B);
  const { v, add, sub, mul, eq, and, or, set, ifThen, ifElse, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, costume, cond, setSize, sin } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("kind", 1), cloneMyself(), set("kind", 2), cloneMyself(), set("kind", 3), cloneMyself()], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), cond([[eq(v("kind"), 1), [costume("cursor")]], [eq(v("kind"), 2), [costume("right")]]], [costume("wrong")])], 20, 160);
  const at = (idx: any) => goto(add(mul(sub(idx, v("cam")), SP), v("shakeX")), add(PAD_Y, v("shakeY")));
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    setSize(add(105, mul(10, sin(mul(v("frame"), 12))))),
    cond([
      [eq(v("kind"), 1), [ifElse(and(eq(v("phase"), "play"), eq(v("state"), "ask")), [at(v("cur")), show()], [hide()])]],
      [eq(v("kind"), 2), [ifElse(eq(v("showRight"), 1), [at(v("target")), show()], [hide()])]],
    ], [ifElse(eq(v("showWrong"), 1), [at(v("chose")), show()], [hide()])]),
  ])], 20, 260);
  void or;
  return B;
}

// ---------------------------------------------------------------- Flies, Sign, Beads, Hearts, Flash, Hud
function flyScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "k");
  const d = dsl(B);
  const { v, add, sub, mul, eq, lt, abs, and, not, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto,
    cloneMyself, item, sin, cos, costume, mod } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("k", 1), repeat(FLIES, [cloneMyself(), change("k", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(and(eq(v("phase"), "play"), and(lt(abs(sub(item("flyIdx", v("k")), v("cam"))), HALF), not(eq(item("flyIdx", v("k")), v("fi"))))), [
      goto(add(mul(sub(item("flyIdx", v("k")), v("cam")), SP), mul(6, sin(mul(v("frame"), add(7, v("k")))))),
        add(PAD_Y + 26, mul(5, cos(mul(v("frame"), add(9, v("k"))))))),
      ifElse(lt(mod(v("frame"), 4), 2), [costume("up")], [costume("down")]), show()], [hide()]),
  ])], 20, 240);
  return B;
}
function signScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, 90), d.hide()], 20, 20);
  B.script(d.whenReceive("tick"), [d.ifElse(d.eq(d.v("phase"), "play"), [d.show()], [d.hide()])], 20, 100);
  return B;
}
function beadScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "b");
  const d = dsl(B);
  const { v, add, mul, div, eq, and, gt, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, costume, ceiling } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("b", 1), repeat(BEADS, [goto(add(-99, mul(v("b"), 18)), -158), cloneMyself(), change("b", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  // The time left, as beads.
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(and(eq(v("phase"), "play"), eq(v("state"), "ask")), [
      ifElse(gt(v("b"), ceiling(mul(div(v("timeLeft"), v("timeTotal")), BEADS))), [costume("off")], [costume("on")]), show()], [hide()]),
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
    P.sprite("Pad", { blocks: clickable(padScripts()), costumes: A.pad, layer: 1, visible: false }),
    P.sprite("Ring", { blocks: clickable(ringScripts()), costumes: A.ring, layer: 2, visible: false }),
    P.sprite("Frog", { blocks: clickable(frogScripts()), costumes: A.frog, layer: 3, x: 0, y: PAD_Y + 4, rotationStyle: "left-right" }),
    P.sprite("Fly", { blocks: clickable(flyScripts()), costumes: A.fly, layer: 4, visible: false }),
    P.sprite("Sign", { blocks: clickable(signScripts()), costumes: A.sign, layer: 5, visible: false }),
    P.sprite("Bead", { blocks: clickable(beadScripts()), costumes: A.bead, layer: 6, visible: false }),
    P.sprite("Hud", { blocks: clickable(hudScripts()), costumes: A.hud, layer: 7, x: 0, y: 157 }),
    P.sprite("Heart", { blocks: clickable(heartScripts()), costumes: A.heart, layer: 8, visible: false }),
    P.sprite("Spark", { blocks: sparkScripts(P), costumes: sparkCostumes(P), layer: 9, visible: false }),
    P.sprite("Text", { blocks: textScripts(P), costumes: textCostumes(P, "number-line-jumper"), layer: 10, visible: false }),
    P.sprite("Flash", { blocks: clickable(flashScripts()), costumes: A.flash, layer: 11, visible: false }),
  ],
  listValues: {
    ...kitLists(),
    slotX: Array(WIN).fill(0), slotY: Array(WIN).fill(PAD_Y), padIdx: Array(WIN).fill(0), padLab: Array(WIN).fill("?"),
    flyIdx: [3, -4], signs: [1, -1],
  },
  shown: [],
});
writeFileSync(new URL("number-line-jumper.sb3", import.meta.url), sb3);
console.log(`number-line-jumper.sb3: ${sb3.length} bytes`);
