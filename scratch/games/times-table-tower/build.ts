// Builds times-table-tower.sb3: a maths stacking game. A crane swings a block over the tower; the number on the block
// changes on every swing. Drop it (click or Space) when it shows the answer to the question at the top. A right block
// lands on the tower and whatever hangs over the edge is cut off; a perfect drop keeps the full width. A wrong number
// (or a block that misses the tower) smashes and costs a heart.
//
// Uses the generator's newer features: the tower is a record (floor.x, floor.w, floor.ans), "pick table" and "wrong %s %s"
// are custom blocks that return values, and cond/max/min are macros.
//
// Drawing: the Stage works out every position once per frame into the kit's slot lists (slotX/slotY), then broadcasts
// `tick`. Floor clones form a ring: clone j shows the highest row r with r ≡ j (mod RING), so a new floor only changes
// one clone and one text group.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { record } from "../../lib/records.ts";
import { textCostumes, textScripts, sparkCostumes, sparkScripts, kitLists, write, clear, pulse, emit } from "../math-kit/kit.ts";
import { art, H, MIN_W, MAX_W } from "./art.ts";

const P = new Project();
type D = ReturnType<typeof dsl>;
export const RING = 12, CARRY = RING + 1;            // ring slots 1..RING are floors, slot CARRY is the swinging block
export const GROUND_Y = -150, HOOK_Y = 92, SWING = 170, START_W = 120;
const G = { score: 1, mult: 2, levelWord: 3, levelNum: 4, banner: 5, bannerNum: 6, title1: 7, title2: 8, click: 9,
  best: 10, bestWord: 11, pop: 12, question: 13, bonusWord: 14, carry: 15, praise: 16, floor: 19 };   // floor j: 19 + j
const floorRecord = (d: D) => record(d, "floor", ["x", "w", "ans"] as const);

// ---------------------------------------------------------------- Stage: the game
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, or, and, not, join, set, change, ifThen, ifElse, repeat, until, whenFlag,
    whenReceive, forever, broadcast, wait, random, item, replace, contains, define, call, round, ceiling, mod, abs, sin, cos,
    key, mouseDown, deleteAll, addTo, insertAt, length, switchBackdrop, arg, cond, max, min, ret, compute, fn } = d;
  const floor = floorRecord(d);
  const top = (f: "x" | "w") => floor.get(f, floor.count());

  B.script(whenFlag(), [
    set("phase", "title"), set("shake", 0), set("frame", 0), set("hideAbove", 400), set("score", 0), set("shown", 0),
    set("hearts", 3), set("level", 1), set("state", "wait"), set("waitT", 0), set("held", 1), set("cam", 0),
    set("hookT", 0), set("swingSpeed", 2.5), set("cw", START_W), set("dropX", 0), set("dropY", HOOK_Y),
    ...floor.clear(), switchBackdrop("day"),
    call("title screen"),
    forever([
      change("frame", 1),
      set("shake", mul(v("shake"), 0.85)), ifThen(lt(v("shake"), 0.4), [set("shake", 0)]),
      set("shakeX", random(mul(v("shake"), -1), v("shake"))), set("shakeY", random(mul(v("shake"), -1), v("shake"))),
      // A press is the moment the mouse button or Space goes down.
      set("press", 0),
      ifElse(or(mouseDown(), key("space")), [ifThen(eq(v("held"), 0), [set("press", 1)]), set("held", 1)], [set("held", 0)]),
      cond([
        [eq(v("phase"), "play"), [call("play")]],
        [or(eq(v("phase"), "title"), eq(v("phase"), "ready")), [
          replace("groupColor", G.title1, mul(v("frame"), 3)), replace("groupColor", G.title2, mul(v("frame"), 3)),
          ifThen(eq(mod(v("frame"), 20), 0), [pulse(d, G.click, 18)]),
          // The hook swings slowly behind the title.
          change("hookT", 1.5), set("hookX", mul(SWING, sin(v("hookT")))),
          ifThen(eq(v("press"), 1), [call("new game")]),
        ]],
      ]),
      call("camera"),
      call("roll score"),
      broadcast("tick"),
    ]),
  ], 20, 20);

  define("title screen", [
    ...write(d, { text: "word-tower1", x: 0, y: 70, size: 100, group: G.title1 }),
    ...write(d, { text: "word-tower2", x: 0, y: 12, size: 150, group: G.title2 }),
    ...write(d, { text: "word-clickplay", x: 0, y: -60, size: 56, group: G.click }),
    ifThen(gt(v("best"), 0), [
      ...write(d, { text: "word-best", x: -40, y: 157, size: 34, group: G.bestWord }),
      ...write(d, { text: v("best"), x: 50, y: 157, size: 40, group: G.best }),
    ]),
  ], { warp: true, x: 560, y: 20 });

  define("new game", [
    ...[G.title1, G.title2, G.click, G.best, G.bestWord, G.banner, G.bannerNum, G.bonusWord, G.mult, G.pop, G.praise]
      .flatMap(g => clear(d, g)),
    ...Array.from({ length: RING }, (_, j) => clear(d, G.floor + j + 1)).flat(),
    set("score", 0), set("shown", -1), set("hearts", 3), set("level", 1), set("streak", 0), set("mult", 1), set("perfects", 0),
    ...floor.clear(), set("cw", START_W), set("cam", 0), set("lastAns", 0),
    broadcast("hearts"), switchBackdrop("day"),
    set("phase", "play"),
    call("start level"),
  ], { warp: true, x: 560, y: 360 });

  define("start level", [
    set("floorsDone", 0), set("goal", add(5, v("level"))),
    set("swingSpeed", min(7, add(1.9, mul(0.6, v("level"))))),
    ...write(d, { text: "word-level", x: -175, y: -163, size: 26, group: G.levelWord }),
    ...write(d, { text: v("level"), x: -122, y: -163, size: 32, group: G.levelNum }),
    ...write(d, { text: "word-level", x: -30, y: 40, size: 100, group: G.banner }),
    ...write(d, { text: v("level"), x: 115, y: 40, size: 120, group: G.bannerNum }),
    pulse(d, G.banner, 40), pulse(d, G.bannerNum, 40), set("bannerT", 60),
    call("new question"),
    set("state", "wait"), set("waitT", 25), ...clear(d, G.carry),
  ], { warp: true, x: 560, y: 760 });

  // ---------------------------------------------------------------- questions
  // The times table for this level (a custom block that returns a value).
  define("pick table", [
    cond([
      [eq(v("level"), 1), ret("pick table", item("tables1", random(1, length("tables1"))))],
      [eq(v("level"), 2), ret("pick table", item("tables2", random(1, length("tables2"))))],
      [eq(v("level"), 3), ret("pick table", item("tables3", random(1, length("tables3"))))],
      [eq(v("level"), 4), ret("pick table", item("tables4", random(1, length("tables4"))))],
    ], ret("pick table", random(2, 12))),
  ], { warp: true, x: 1100, y: 20 });
  // A believable wrong answer for a × b: a neighbouring row or column of the table, or one or two off.
  define("wrong %s %s", [
    set("k", random(1, 6)),
    cond([
      [eq(v("k"), 1), ret("wrong %s %s", mul(arg("a"), add(arg("b"), 1)))],
      [eq(v("k"), 2), ret("wrong %s %s", mul(arg("a"), sub(arg("b"), 1)))],
      [eq(v("k"), 3), ret("wrong %s %s", mul(add(arg("a"), 1), arg("b")))],
      [eq(v("k"), 4), ret("wrong %s %s", mul(sub(arg("a"), 1), arg("b")))],
      [eq(v("k"), 5), ret("wrong %s %s", add(mul(arg("a"), arg("b")), random(1, 3)))],
    ], ret("wrong %s %s", sub(mul(arg("a"), arg("b")), random(1, 3)))),
  ], { args: ["a", "b"], warp: true, x: 1100, y: 400 });

  define("new question", [
    set("ans", v("lastAns")),
    until(not(eq(v("ans"), v("lastAns"))), [
      ...compute("qa", [fn("pick table")]),
      set("qb", random(1, 10)), ifThen(gt(v("level"), 4), [set("qb", random(2, 12))]),
      set("ans", mul(v("qa"), v("qb"))),
    ]),
    set("lastAns", v("ans")),
    // Three wrong numbers, and the answer somewhere after the first (so you have to wait for it).
    deleteAll("cand"),
    until(eq(length("cand"), 3), [
      ...compute("c", [fn("wrong %s %s", v("qa"), v("qb"))]),
      ifThen(and(gt(v("c"), 0), and(not(eq(v("c"), v("ans"))), not(contains("cand", v("c"))))), [addTo("cand", v("c"))]),
    ]),
    insertAt("cand", random(2, 4), v("ans")),
    set("ci", 1), set("passes", 0),
    ...write(d, { text: join(join(v("qa"), "×"), v("qb")), x: 0, y: 156, size: 64, group: G.question }), pulse(d, G.question, 30),
  ], { warp: true, x: 1100, y: 800 });

  // ---------------------------------------------------------------- one frame of play
  define("play", [
    ifThen(gt(v("bannerT"), 0), [change("bannerT", -1), ifThen(eq(v("bannerT"), 0), [...clear(d, G.banner), ...clear(d, G.bannerNum)])]),
    change("hookT", v("swingSpeed")), set("hookX", mul(SWING, sin(v("hookT")))),
    // Every time the swing turns round, the block shows the next number.
    set("dir", 1), ifThen(lt(cos(v("hookT")), 0), [set("dir", -1)]),
    ifThen(and(not(eq(v("dir"), v("lastDir"))), eq(v("state"), "carry")), [call("next number")]),
    set("lastDir", v("dir")),
    cond([
      [eq(v("state"), "carry"), [
        set("dropX", v("hookX")), set("dropY", HOOK_Y),
        ifThen(eq(v("press"), 1), [set("state", "fall"), set("vy", 0)]),
      ]],
      [eq(v("state"), "fall"), [
        change("vy", -0.9), change("dropY", v("vy")),
        set("landY", sub(add(GROUND_Y, mul(add(floor.count(), 0.5), H)), v("cam"))),
        ifThen(not(gt(v("dropY"), v("landY"))), [call("land")]),
      ]],
      [eq(v("state"), "wait"), [
        change("waitT", -1),
        ifThen(not(gt(v("waitT"), 0)), [set("state", "carry"), set("ci", 0), call("next number")]),
      ]],
    ]),
  ], { warp: true, x: 1600, y: 20 });

  define("next number", [
    set("ci", add(mod(v("ci"), length("cand")), 1)), change("passes", 1),
    ...write(d, { text: item("cand", v("ci")), x: 0, y: 0, size: 40, group: G.carry, mode: "follow", follow: CARRY }),
    pulse(d, G.carry, 35),
  ], { warp: true, x: 1600, y: 700 });

  // ---------------------------------------------------------------- landing
  define("land", [
    set("dropY", v("landY")), ...clear(d, G.carry),
    ifElse(not(eq(item("cand", v("ci")), v("ans"))), [set("why", "oops"), call("smash")], [
      // The top of the tower: the last floor, or the foundation.
      ifElse(eq(floor.count(), 0), [set("tx", 0), set("tw", MAX_W)], [set("tx", top("x")), set("tw", top("w"))]),
      set("l", max(sub(v("dropX"), div(v("cw"), 2)), sub(v("tx"), div(v("tw"), 2)))),
      set("r", min(add(v("dropX"), div(v("cw"), 2)), add(v("tx"), div(v("tw"), 2)))),
      ifElse(not(gt(abs(sub(v("dropX"), v("tx"))), 4)), [
        // Perfect: lined up with the floor below. Three in a row make the block wider again.
        set("perfect", 1), change("perfects", 1), set("nx", v("tx")), set("nw", min(v("cw"), v("tw"))),
        ifThen(eq(mod(v("perfects"), 3), 0), [set("nw", min(MAX_W, add(v("nw"), 10)))]),
      ], [
        set("perfect", 0), set("perfects", 0),
        set("nx", div(add(v("l"), v("r")), 2)), set("nw", mul(round(div(sub(v("r"), v("l")), 5)), 5)),
      ]),
      ifElse(lt(v("nw"), MIN_W), [set("why", "wobbly"), call("smash")], [call("stack")]),
    ]),
  ], { warp: true, x: 2100, y: 20 });

  define("stack", [
    ...floor.add({ x: v("nx"), w: v("nw"), ans: v("ans") }),
    // The answer is written on the new floor (ring slot j).
    set("j", add(mod(sub(floor.count(), 1), RING), 1)),
    ...write(d, { text: v("ans"), x: 0, y: 0, size: 34, group: add(G.floor, v("j")), mode: "follow", follow: v("j") }),
    // Trimmed pieces fall off as debris.
    ifThen(gt(sub(v("cw"), v("nw")), 0), [...emit(d, "debris", ifX(d), v("dropY"), 6)]),
    set("cw", v("nw")),
    ...emit(d, "smoke", v("nx"), sub(v("dropY"), 12), 6),
    // Points: 100 × level, plus perfect and quick bonuses, times the combo multiplier.
    change("streak", 1),
    set("mult", 1), cond([[gt(v("streak"), 7), [set("mult", 5)]], [gt(v("streak"), 4), [set("mult", 3)]], [gt(v("streak"), 2), [set("mult", 2)]]]),
    set("pts", mul(100, v("level"))),
    ifThen(eq(v("perfect"), 1), [
      change("pts", mul(250, v("perfects"))),
      ...write(d, { text: "word-perfect", x: 0, y: 70, size: 80, group: G.praise, mode: "float" }),
      ...emit(d, "ring", v("nx"), v("dropY"), 1), ...emit(d, "spark", v("nx"), v("dropY"), 14), set("shake", 4),
    ]),
    ifThen(eq(v("perfect"), 0), [ifThen(gt(sub(v("tw"), v("nw")), 25), [
      ...write(d, { text: "word-wobbly", x: 0, y: 70, size: 70, group: G.praise, mode: "float" })])]),
    // Quick: dropped the first time the answer came round.
    ifThen(not(gt(v("passes"), 4)), [change("pts", 200),
      ...write(d, { text: "word-quick", x: 0, y: 30, size: 60, group: G.bonusWord, mode: "float" })]),
    set("pts", mul(v("pts"), v("mult"))), change("score", v("pts")),
    ...write(d, { text: join("+", v("pts")), x: v("nx"), y: add(v("dropY"), 30), size: 44, group: G.pop, mode: "float" }),
    ifElse(gt(v("mult"), 1), [
      ...write(d, { text: join("×", v("mult")), x: -82, y: 157, size: 34, group: G.mult }), pulse(d, G.mult, 40)],
      [...clear(d, G.mult)]),
    change("floorsDone", 1),
    ifElse(not(lt(v("floorsDone"), v("goal"))), [set("phase", "bonus"), set("state", "none"), broadcast("level done")], [
      call("new question"), set("state", "wait"), set("waitT", 14)]),
  ], { warp: true, x: 2100, y: 900 });

  define("smash", [
    ...emit(d, "debris", v("dropX"), v("dropY"), 16), ...emit(d, "smoke", v("dropX"), v("dropY"), 5),
    set("shake", 10), set("flashKind", "red"), broadcast("flash"),
    ...write(d, { text: join("word-", v("why")), x: v("dropX"), y: add(v("dropY"), 40), size: 70, group: G.praise, mode: "float" }),
    change("hearts", -1), broadcast("hearts"), set("streak", 0), set("mult", 1), set("perfects", 0), ...clear(d, G.mult),
    ifElse(not(gt(v("hearts"), 0)), [set("phase", "over"), set("state", "none"), broadcast("game over")], [
      set("state", "wait"), set("waitT", 35)]),
  ], { warp: true, x: 2100, y: 1900 });

  // ---------------------------------------------------------------- level done: bonus, confetti, a new sky
  B.script(whenReceive("level done"), [
    ...clear(d, G.question), wait(0.6),
    ...write(d, { text: "word-levelup", x: 0, y: 60, size: 110, group: G.banner }), pulse(d, G.banner, 50),
    set("flashKind", "white"), broadcast("flash"),
    repeat(5, [...emit(d, "confetti", random(-200, 200), 190, 12), wait(0.12)]),
    set("bonus", mul(mul(v("hearts"), 500), v("level"))),
    ...write(d, { text: "word-bonus", x: -60, y: 0, size: 70, group: G.bonusWord }),
    set("b", 0),
    until(eq(v("b"), v("bonus")), [
      set("b", min(v("bonus"), add(v("b"), ceiling(div(v("bonus"), 25))))),
      ...write(d, { text: v("b"), x: 80, y: 0, size: 80, group: G.bannerNum }),
      wait(0.03),
    ]),
    pulse(d, G.bannerNum, 50), change("score", v("bonus")),
    wait(1.2),
    ...[G.banner, G.bannerNum, G.bonusWord].flatMap(g => clear(d, g)),
    change("level", 1), set("hearts", min(3, add(v("hearts"), 1))), broadcast("hearts"),
    cond([[eq(v("level"), 2), [switchBackdrop("sunset")]], [eq(v("level"), 3), [switchBackdrop("night")]],
      [gt(v("level"), 3), [switchBackdrop("space")]]]),
    set("phase", "play"),
    call("start level"),
  ], 20, 1300);

  B.script(whenReceive("game over"), [
    ...clear(d, G.carry), ...clear(d, G.question),
    // The tower crumbles.
    set("j", 1), repeat(RING, [
      ifThen(lt(item("slotY", v("j")), 200), [...emit(d, "debris", item("slotX", v("j")), item("slotY", v("j")), 4)]),
      change("j", 1)]),
    set("shake", 14),
    ...write(d, { text: "word-gameover", x: 0, y: 80, size: 110, group: G.banner }), pulse(d, G.banner, 40),
    ...write(d, { text: v("score"), x: 0, y: 10, size: 100, group: G.bannerNum }),
    ifThen(gt(v("score"), v("best")), [set("best", v("score")),
      ...write(d, { text: "word-best", x: 0, y: -45, size: 60, group: G.bestWord }), pulse(d, G.bestWord, 50),
      repeat(4, [...emit(d, "confetti", random(-200, 200), 190, 10)])]),
    wait(2),
    ...write(d, { text: "word-clickplay", x: 0, y: -100, size: 56, group: G.click }),
    set("phase", "ready"),
  ], 20, 2300);

  // ---------------------------------------------------------------- camera: every position for this frame
  define("camera", [
    set("cam", add(v("cam"), mul(sub(max(0, sub(mul(floor.count(), H), 150)), v("cam")), 0.12))),
    set("j", 1),
    repeat(RING, [
      // The highest row in ring slot j.
      set("row", sub(floor.count(), mod(sub(floor.count(), v("j")), RING))),
      set("y", sub(add(GROUND_Y, mul(sub(v("row"), 0.5), H)), v("cam"))),
      ifElse(or(lt(v("row"), 1), lt(v("y"), -200)), [replace("ringRow", v("j"), 0), replace("slotY", v("j"), 9999)], [
        replace("ringRow", v("j"), v("row")), replace("slotX", v("j"), floor.get("x", v("row"))), replace("slotY", v("j"), v("y"))]),
      change("j", 1),
    ]),
    replace("slotX", CARRY, v("dropX")),
    ifElse(or(eq(v("state"), "carry"), eq(v("state"), "fall")), [replace("slotY", CARRY, v("dropY"))], [replace("slotY", CARRY, 9999)]),
  ], { warp: true, x: 2700, y: 20 });

  define("roll score", [
    ifThen(and(not(eq(v("shown"), v("score"))), not(eq(v("phase"), "title"))), [
      ifElse(lt(v("shown"), 0), [set("shown", 0)], [change("shown", ceiling(div(sub(v("score"), v("shown")), 6)))]),
      ifThen(gt(v("shown"), v("score")), [set("shown", v("score"))]),
      ...write(d, { text: v("shown"), x: -165, y: 157, size: 46, group: G.score }), pulse(d, G.score, 14),
    ]),
  ], { warp: true, x: 2700, y: 700 });
  void repeat; void addTo;
  return B;
}
// Where the trimmed piece falls: the side of the block that hung over.
const ifX = (d: D) => d.add(d.v("nx"), d.mul(d.div(d.add(d.v("nw"), d.v("cw")), 2), d.div(d.sub(d.v("dropX"), d.v("tx")), d.add(d.abs(d.sub(d.v("dropX"), d.v("tx"))), 0.001))));

// ---------------------------------------------------------------- Floor: RING clones, one per ring slot
function floorScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "j");
  const d = dsl(B);
  const { v, add, mul, eq, lt, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto,
    cloneMyself, item, costumeTo, join, setEffect } = d;
  const floor = floorRecord(d);
  B.script(whenFlag(), [hide(), set("isClone", 0), set("j", 1), repeat(RING, [cloneMyself(), change("j", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(lt(item("ringRow", v("j")), 1), [hide()], [
      costumeTo(join("w", floor.get("w", item("ringRow", v("j"))))),
      // Every few floors the colour shifts, so the tower is striped.
      setEffect("COLOR", mul(d.floor(d.div(item("ringRow", v("j")), 3)), 18)),
      goto(add(item("slotX", v("j")), v("shakeX")), add(item("slotY", v("j")), v("shakeY"))), show(),
    ]),
  ])], 20, 240);
  return B;
}

// ---------------------------------------------------------------- Drop (the swinging block), Hook, Ground, Hearts, Flash, Hud
function dropScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, mul, eq, ifElse, whenFlag, whenReceive, hide, show, goto, costumeTo, join, setEffect, lt, item } = d;
  B.script(whenFlag(), [hide()], 20, 20);
  B.script(whenReceive("tick"), [
    ifElse(lt(item("slotY", CARRY), 9000), [
      costumeTo(join("w", v("cw"))), setEffect("COLOR", mul(d.floor(d.div(add(d.length("floor.x"), 1), 3)), 18)),
      goto(add(v("dropX"), v("shakeX")), add(v("dropY"), v("shakeY"))), show()], [hide()]),
  ], 20, 100);
  void eq;
  return B;
}
function hookScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, eq, or, ifElse, whenFlag, whenReceive, show, goto } = d;
  B.script(whenFlag(), [show()], 20, 20);
  B.script(whenReceive("tick"), [
    // The hook carries the block, and swings on alone while a block falls.
    ifElse(eq(v("state"), "carry"), [goto(v("dropX"), add(HOOK_Y, H / 2))], [goto(v("hookX"), add(HOOK_Y, H / 2))]),
  ], 20, 100);
  void or; void show;
  return B;
}
function groundScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, sub, add, lt, ifElse, whenFlag, whenReceive, hide, show, goto } = d;
  B.script(whenFlag(), [goto(0, GROUND_Y), show()], 20, 20);
  B.script(whenReceive("tick"), [
    ifElse(lt(sub(GROUND_Y, v("cam")), -260), [hide()], [goto(v("shakeX"), add(sub(GROUND_Y, v("cam")), v("shakeY"))), show()]),
  ], 20, 100);
  return B;
}
function heartScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "idx");
  const d = dsl(B);
  const { v, eq, gt, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, costume, add, mul } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("idx", 1), repeat(3, [goto(add(130, mul(v("idx"), 30)), 157), cloneMyself(), change("idx", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), costume("on"), show()], 20, 160);
  B.script(whenReceive("hearts"), [ifThen(eq(v("isClone"), 1), [ifElse(gt(v("idx"), v("hearts")), [costume("off")], [costume("on")])])], 20, 240);
  void hide;
  return B;
}
function flashScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.hide()], 20, 20);
  B.script(d.whenReceive("flash"), [d.costumeTo(d.v("flashKind")), d.setEffect("GHOST", 50), d.show(), d.front()], 20, 100);
  B.script(d.whenReceive("tick"), [d.changeEffect("GHOST", 8)], 20, 220);
  return B;
}
function hudScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, 157), d.show()], 20, 20);
  return B;
}

const A = art(P);
const flash = (c: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="${c}"/></svg>`;
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Ground", { blocks: groundScripts(), costumes: A.ground, layer: 1, x: 0, y: GROUND_Y }),
    P.sprite("Floor", { blocks: floorScripts(), costumes: A.floor, layer: 2, visible: false }),
    P.sprite("Hook", { blocks: hookScripts(), costumes: A.hook, layer: 3, x: 0, y: HOOK_Y + H / 2 }),
    P.sprite("Drop", { blocks: dropScripts(), costumes: A.floor, layer: 4, visible: false }),
    P.sprite("Hud", { blocks: hudScripts(), costumes: A.hud, layer: 5, x: 0, y: 157 }),
    P.sprite("Heart", { blocks: heartScripts(), costumes: A.heart, layer: 6, visible: false }),
    P.sprite("Spark", { blocks: sparkScripts(P), costumes: sparkCostumes(P), layer: 7, visible: false }),
    P.sprite("Text", { blocks: textScripts(P), costumes: textCostumes(P, "times-table-tower"), layer: 8, visible: false }),
    P.sprite("Flash", { blocks: flashScripts(), costumes: [P.costume("white", flash("#fff"), 240, 180), P.costume("red", flash("#ef4444"), 240, 180)], layer: 9, visible: false }),
  ],
  listValues: {
    ...kitLists(),
    slotX: Array(CARRY).fill(0), slotY: Array(CARRY).fill(9999), ringRow: Array(RING).fill(0),
    "floor.x": [], "floor.w": [], "floor.ans": [], cand: [],
    tables1: [2, 5, 10], tables2: [3, 4, 2, 5], tables3: [6, 7, 3, 4], tables4: [8, 9, 6, 7],
  },
  shown: [],
});
writeFileSync(new URL("times-table-tower.sb3", import.meta.url), sb3);
console.log(`times-table-tower.sb3: ${sb3.length} bytes`);
void ({} as In);
