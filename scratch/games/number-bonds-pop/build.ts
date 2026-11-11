// Builds number-bonds-pop.sb3: a maths game about number bonds. Numbered bubbles rise through the sea; click two that
// make the target (MAKE 10: 3 and 7). They drift together, show the sum and pop. A wrong pair costs a heart. Gold
// bubbles score double; a rainbow bubble (★) matches anything. Levels: bonds to 10, then 20, then 100 (in fives).
//
// The bubbles are a record with one row per bubble clone (bub.on, bub.x, bub.n, ...). Bubbles come in pairs, so every
// bubble on screen has a partner somewhere (or had one that floated away). The Stage moves everything once per frame,
// writes the positions into the kit's slot lists, then broadcasts `tick`.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { record } from "../../lib/records.ts";
import { textCostumes, textScripts, sparkCostumes, sparkScripts, kitLists, write, clear, pulse, emit } from "../math-kit/kit.ts";
import { art } from "./art.ts";

const P = new Project();
type D = ReturnType<typeof dsl>;
export const SLOTS = 10, TOP = 205, BOTTOM = -215;
const G = { score: 1, mult: 2, levelWord: 3, levelNum: 4, banner: 5, bannerNum: 6, title1: 7, title2: 8, click: 9,
  best: 10, bestWord: 11, pop: 12, makeWord: 13, target: 14, bonusWord: 15, praise: 16, sum: 17, bubble: 20 };  // bubble j: 20 + j
const FIELDS = ["on", "bx", "x", "y", "n", "kind", "speed", "phase", "sel", "merge", "tx", "ty", "wob"] as const;
const bubbles = (d: D) => record(d, "bub", FIELDS);
const PLAIN = 0, GOLD = 1, RAINBOW = 2;

// ---------------------------------------------------------------- Stage: the game
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, or, and, not, join, set, change, ifThen, ifElse, repeat, until, whenFlag,
    whenReceive, forever, broadcast, wait, random, replace, define, call, ceiling, mod, abs, sin, switchBackdrop,
    arg, cond, max, min, ret, compute, fn, item } = d;
  const bub = bubbles(d);
  const at = (f: typeof FIELDS[number]) => bub.get(f, v("j"));

  B.script(whenFlag(), [
    set("phase", "title"), set("shake", 0), set("frame", 0), set("hideAbove", 400), set("score", 0), set("shown", 0),
    set("hearts", 3), set("level", 1), set("tap", 0), set("pickQ", 0), set("sel1", 0), set("target", 10),
    switchBackdrop("shallow"),
    set("j", 1), repeat(SLOTS, [bub.set("on", v("j"), 0), change("j", 1)]),
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
      call("move bubbles"),
      call("roll score"),
      broadcast("tick"),
    ]),
  ], 20, 20);
  // Taps: on a bubble (its clone, or the number on it) it picks that bubble; anywhere else it is a plain tap.
  // Text (a number, or a word floating up) can lie over a bubble, so a click on text or on the sea looks for the bubble
  // under the mouse itself.
  const tapAt = [...compute("hit", [fn("bubble at mouse")]), ifElse(gt(v("hit"), 0), [set("pickQ", v("hit"))], [set("tap", 1)])];
  B.script(d.whenStageClicked(), tapAt, 20, 900);
  B.script(d.whenKey("space"), [set("tap", 1)], 20, 980);
  B.script(whenReceive("text click"), tapAt, 20, 1060);
  B.script(whenReceive("sea click"), tapAt, 20, 1140);
  // The bubble under the mouse (within its radius), or 0.
  define("bubble at mouse", [
    set("near", 0), set("nearD", 40), set("k", 1),
    repeat(SLOTS, [
      set("dd", d.sqrt(add(mul(sub(item("slotX", v("k")), d.mouseX()), sub(item("slotX", v("k")), d.mouseX())),
        mul(sub(item("slotY", v("k")), d.mouseY()), sub(item("slotY", v("k")), d.mouseY()))))),
      ifThen(lt(v("dd"), v("nearD")), [set("near", v("k")), set("nearD", v("dd"))]),
      change("k", 1)]),
    ...ret("bubble at mouse", v("near")),
  ], { warp: true, x: 560, y: 1300 });

  define("title screen", [
    ...write(d, { text: "word-bonds1", x: 0, y: 70, size: 96, group: G.title1 }),
    ...write(d, { text: "word-bonds2", x: 0, y: 10, size: 150, group: G.title2 }),
    ...write(d, { text: "word-clickplay", x: 0, y: -70, size: 56, group: G.click }),
    ifThen(gt(v("best"), 0), [
      ...write(d, { text: "word-best", x: -40, y: -120, size: 34, group: G.bestWord }),
      ...write(d, { text: v("best"), x: 50, y: -120, size: 40, group: G.best }),
    ]),
  ], { warp: true, x: 560, y: 20 });

  define("new game", [
    ...[G.title1, G.title2, G.click, G.best, G.bestWord, G.banner, G.bannerNum, G.bonusWord, G.mult, G.pop, G.praise, G.sum]
      .flatMap(g => clear(d, g)),
    call("pop all %s", 0),
    set("score", 0), set("shown", -1), set("hearts", 3), set("level", 1), set("streak", 0), set("mult", 1),
    broadcast("hearts"), switchBackdrop("shallow"),
    set("phase", "play"),
    call("start level"),
  ], { warp: true, x: 560, y: 360 });

  define("start level", [
    set("pairsDone", 0), set("spawned", 0), set("goal", add(6, mul(2, v("level")))), set("sel1", 0),
    set("target", 10), cond([[gt(v("level"), 4), [set("target", 100)]], [gt(v("level"), 2), [set("target", 20)]]]),
    set("spawnGap", max(28, sub(85, mul(9, v("level"))))), set("spawnT", 20),
    ...write(d, { text: "word-make", x: -10, y: 157, size: 40, group: G.makeWord }),
    ...write(d, { text: v("target"), x: 75, y: 157, size: 56, group: G.target }), pulse(d, G.target, 40),
    ...write(d, { text: "word-level", x: -175, y: -163, size: 26, group: G.levelWord }),
    ...write(d, { text: v("level"), x: -122, y: -163, size: 32, group: G.levelNum }),
    ...write(d, { text: "word-level", x: -30, y: 40, size: 100, group: G.banner }),
    ...write(d, { text: v("level"), x: 115, y: 40, size: 120, group: G.bannerNum }),
    pulse(d, G.banner, 40), pulse(d, G.bannerNum, 40), set("bannerT", 60),
  ], { warp: true, x: 560, y: 760 });

  // ---------------------------------------------------------------- one frame of play
  define("play", [
    ifThen(gt(v("bannerT"), 0), [change("bannerT", -1), ifThen(eq(v("bannerT"), 0), [...clear(d, G.banner), ...clear(d, G.bannerNum)])]),
    // A new pair now and then, while the level still needs pairs (a few spare ones, as some float away).
    change("spawnT", -1),
    ifThen(and(not(gt(v("spawnT"), 0)), lt(v("spawned"), add(v("goal"), 4))), [call("spawn pair"), set("spawnT", v("spawnGap"))]),
    ifThen(gt(v("pick"), 0), [call("pick %s", v("pick"))]),
    // Level done when the goal is met; or when no more pairs come and the sea is empty (some floated away).
    ifThen(not(lt(v("pairsDone"), v("goal"))), [set("phase", "bonus"), broadcast("level done")]),
    ifThen(and(eq(v("phase"), "play"), and(not(lt(v("spawned"), add(v("goal"), 4))), eq(bub.find("on", 1), 0))), [
      set("spawned", sub(v("spawned"), 3))]),
  ], { warp: true, x: 1100, y: 20 });

  // The first free bubble row, or 0 (returns a value).
  define("free slot", [...ret("free slot", bub.find("on", 0))], { warp: true, x: 1100, y: 500 });

  define("spawn pair", [
    // a + b = target; for 100 the numbers go in fives.
    cond([[eq(v("target"), 100), [set("a", mul(5, random(1, 19)))]]], [set("a", random(1, sub(v("target"), 1)))]),
    set("b", sub(v("target"), v("a"))),
    set("kindA", PLAIN), set("kindB", PLAIN), set("roll", random(1, 14)),
    cond([[eq(v("roll"), 1), [set("kindA", GOLD)]], [eq(v("roll"), 2), [set("kindB", RAINBOW)]]]),
    // Far apart: one on each side, the second a little lower.
    set("xa", random(-200, -30)), set("xb", random(30, 200)),
    ifThen(eq(random(1, 2), 1), [set("t", v("xa")), set("xa", v("xb")), set("xb", v("t"))]),
    call("spawn %s %s %s %s", v("a"), v("kindA"), v("xa"), BOTTOM),
    call("spawn %s %s %s %s", v("b"), v("kindB"), v("xb"), sub(BOTTOM, random(40, 140))),
    change("spawned", 1),
  ], { warp: true, x: 1100, y: 700 });

  define("spawn %s %s %s %s", [
    ...compute("s", [fn("free slot")]),
    ifThen(gt(v("s"), 0), [
      ...["on", "sel", "merge", "wob"].map(f => bub.set(f as any, v("s"), f === "on" ? 1 : 0)),
      bub.set("n", v("s"), arg("n")), bub.set("kind", v("s"), arg("kind")),
      bub.set("bx", v("s"), arg("x")), bub.set("x", v("s"), arg("x")), bub.set("y", v("s"), arg("y")),
      bub.set("speed", v("s"), add(add(0.55, mul(0.12, v("level"))), div(random(0, 30), 100))),
      bub.set("phase", v("s"), random(0, 360)),
      ifElse(eq(arg("kind"), RAINBOW),
        [...write(d, { text: "★", x: 0, y: 0, size: 46, group: add(G.bubble, v("s")), mode: "follow", follow: v("s") })],
        [...write(d, { text: arg("n"), x: 0, y: 0, size: 42, group: add(G.bubble, v("s")), mode: "follow", follow: v("s") })]),
    ]),
  ], { args: ["n", "kind", "x", "y"], warp: true, x: 1100, y: 1300 });

  // ---------------------------------------------------------------- picking
  define("pick %s", [
    set("p", arg("j")),
    ifThen(and(eq(bub.get("on", v("p")), 1), eq(bub.get("merge", v("p")), 0)), [
      cond([
        [eq(v("sel1"), 0), [set("sel1", v("p")), bub.set("sel", v("p"), 1), pulse(d, add(G.bubble, v("p")), 30)]],
        [eq(v("sel1"), v("p")), [bub.set("sel", v("p"), 0), set("sel1", 0)]],
      ], [
        set("na", bub.get("n", v("sel1"))), set("nb", bub.get("n", v("p"))),
        ifElse(or(eq(add(v("na"), v("nb")), v("target")),
          or(eq(bub.get("kind", v("sel1")), RAINBOW), eq(bub.get("kind", v("p")), RAINBOW))),
          [call("pair %s %s", v("sel1"), v("p"))], [call("wrong %s %s", v("sel1"), v("p"))]),
      ]),
    ]),
  ], { args: ["j"], warp: true, x: 1700, y: 20 });

  define("pair %s %s", [
    set("pa", arg("a")), set("pb", arg("b")),
    // A rainbow bubble becomes whatever the other one needs.
    ifThen(eq(bub.get("kind", v("pa")), RAINBOW), [set("na", sub(v("target"), v("nb")))]),
    ifThen(eq(bub.get("kind", v("pb")), RAINBOW), [set("nb", sub(v("target"), v("na")))]),
    set("mx", div(add(bub.get("x", v("pa")), bub.get("x", v("pb"))), 2)),
    set("my", div(add(bub.get("y", v("pa")), bub.get("y", v("pb"))), 2)),
    ...[v("pa"), v("pb")].flatMap(s => [bub.set("merge", s, 10), bub.set("tx", s, v("mx")), bub.set("ty", s, v("my")), bub.set("sel", s, 0)]),
    set("sel1", 0),
    change("streak", 1),
    set("mult", 1), cond([[gt(v("streak"), 7), [set("mult", 5)]], [gt(v("streak"), 4), [set("mult", 3)]], [gt(v("streak"), 2), [set("mult", 2)]]]),
    set("pts", mul(100, v("level"))),
    ifThen(or(eq(bub.get("kind", v("pa")), GOLD), eq(bub.get("kind", v("pb")), GOLD)), [set("pts", mul(v("pts"), 2)),
      ...write(d, { text: "word-gold", x: v("mx"), y: add(v("my"), 70), size: 70, group: G.praise, mode: "float" })]),
    ifThen(or(eq(bub.get("kind", v("pa")), RAINBOW), eq(bub.get("kind", v("pb")), RAINBOW)), [
      ...write(d, { text: "word-rainbow", x: v("mx"), y: add(v("my"), 70), size: 64, group: G.praise, mode: "float" })]),
    set("pts", mul(v("pts"), v("mult"))), change("score", v("pts")),
    // The sum, where they meet: 3+7=10.
    ...write(d, { text: join(join(join(join(v("na"), "+"), v("nb")), "="), v("target")), x: v("mx"), y: add(v("my"), 30), size: 50, group: G.sum, mode: "float" }),
    ...write(d, { text: join("+", v("pts")), x: v("mx"), y: sub(v("my"), 20), size: 40, group: G.pop, mode: "float" }),
    ifElse(gt(v("mult"), 1), [
      ...write(d, { text: join("×", v("mult")), x: -82, y: 157, size: 34, group: G.mult }), pulse(d, G.mult, 40)],
      [...clear(d, G.mult)]),
    change("pairsDone", 1),
  ], { args: ["a", "b"], warp: true, x: 1700, y: 700 });

  define("wrong %s %s", [
    ...[arg("a"), arg("b")].flatMap(s => [bub.set("wob", s, 14), bub.set("sel", s, 0)]),
    set("sel1", 0),
    set("shake", 8), set("flashKind", "red"), broadcast("flash"),
    ...write(d, { text: "word-oops", x: bub.get("x", arg("b")), y: add(bub.get("y", arg("b")), 50), size: 64, group: G.praise, mode: "float" }),
    change("hearts", -1), broadcast("hearts"), set("streak", 0), set("mult", 1), ...clear(d, G.mult),
    ifThen(not(gt(v("hearts"), 0)), [set("phase", "over"), broadcast("game over")]),
  ], { args: ["a", "b"], warp: true, x: 1700, y: 1500 });

  // ---------------------------------------------------------------- moving: rise and sway, merge, pop, float away
  define("move bubbles", [
    set("j", 1),
    repeat(SLOTS, [
      ifThen(eq(at("on"), 1), [
        ifElse(gt(at("merge"), 0), [
          bub.set("x", v("j"), add(at("x"), mul(sub(at("tx"), at("x")), 0.3))),
          bub.set("y", v("j"), add(at("y"), mul(sub(at("ty"), at("y")), 0.3))),
          bub.change("merge", v("j"), -1),
          ifThen(eq(at("merge"), 0), [call("burst %s", v("j"))]),
        ], [
          bub.change("y", v("j"), at("speed")),
          bub.set("x", v("j"), add(at("bx"), mul(14, sin(add(at("phase"), mul(v("frame"), 3)))))),
          ifThen(gt(at("wob"), 0), [bub.change("wob", v("j"), -1)]),
          ifThen(gt(at("y"), TOP), [call("float away %s", v("j"))]),
        ]),
      ]),
      // Where the clone and its number go (the wobble shakes it sideways).
      ifElse(eq(at("on"), 1), [
        replace("slotX", v("j"), add(at("x"), mul(at("wob"), sin(mul(v("frame"), 90))))), replace("slotY", v("j"), at("y"))],
        [replace("slotY", v("j"), 9999)]),
      change("j", 1),
    ]),
  ], { warp: true, x: 2300, y: 20 });

  define("burst %s", [
    set("q", arg("j")), bub.set("on", v("q"), 0), ...clear(d, add(G.bubble, v("q"))),
    ...emit(d, "ring", bub.get("x", v("q")), bub.get("y", v("q")), 1),
    ...emit(d, "spark", bub.get("x", v("q")), bub.get("y", v("q")), 10),
    ...emit(d, "confetti", bub.get("x", v("q")), bub.get("y", v("q")), 4),
    set("shake", max(v("shake"), 3)),
  ], { args: ["j"], warp: true, x: 2300, y: 900 });

  define("float away %s", [
    set("q", arg("j")), bub.set("on", v("q"), 0), ...clear(d, add(G.bubble, v("q"))),
    ifThen(eq(v("sel1"), v("q")), [set("sel1", 0)]),
  ], { args: ["j"], warp: true, x: 2300, y: 1300 });

  define("pop all %s", [
    set("j", 1), repeat(SLOTS, [
      ifThen(eq(at("on"), 1), [ifElse(eq(arg("loud"), 1), [call("burst %s", v("j"))],
        [bub.set("on", v("j"), 0), ...clear(d, add(G.bubble, v("j")))])]),
      change("j", 1)]),
    set("sel1", 0),
  ], { args: ["loud"], warp: true, x: 2300, y: 1600 });

  // ---------------------------------------------------------------- level done: every bubble pops, bonus, deeper sea
  B.script(whenReceive("level done"), [
    call("pop all %s", 1),
    wait(0.5),
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
    cond([[gt(v("level"), 4), [switchBackdrop("abyss")]], [gt(v("level"), 2), [switchBackdrop("deep")]]]),
    set("phase", "play"),
    call("start level"),
  ], 20, 1300);

  B.script(whenReceive("game over"), [
    call("pop all %s", 1), ...clear(d, G.makeWord), ...clear(d, G.target),
    set("shake", 12),
    ...write(d, { text: "word-gameover", x: 0, y: 80, size: 110, group: G.banner }), pulse(d, G.banner, 40),
    ...write(d, { text: v("score"), x: 0, y: 10, size: 100, group: G.bannerNum }),
    ifThen(gt(v("score"), v("best")), [set("best", v("score")),
      ...write(d, { text: "word-best", x: 0, y: -45, size: 60, group: G.bestWord }), pulse(d, G.bestWord, 50),
      repeat(4, [...emit(d, "confetti", random(-200, 200), 190, 10)])]),
    wait(2),
    ...write(d, { text: "word-clickplay", x: 0, y: -100, size: 56, group: G.click }),
    set("phase", "ready"),
  ], 20, 2300);

  define("roll score", [
    ifThen(and(not(eq(v("shown"), v("score"))), not(eq(v("phase"), "title"))), [
      ifElse(lt(v("shown"), 0), [set("shown", 0)], [change("shown", ceiling(div(sub(v("score"), v("shown")), 6)))]),
      ifThen(gt(v("shown"), v("score")), [set("shown", v("score"))]),
      ...write(d, { text: v("shown"), x: -165, y: 157, size: 46, group: G.score }), pulse(d, G.score, 14),
    ]),
  ], { warp: true, x: 2900, y: 20 });
  void abs; void item;
  return B;
}

// ---------------------------------------------------------------- Bubble: one clone per row of the record
function bubbleScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "j");
  const d = dsl(B);
  const { v, add, eq, lt, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, whenClicked, hide, show,
    goto, cloneMyself, item, costume, cond } = d;
  const bub = bubbles(d);
  B.script(whenFlag(), [hide(), set("isClone", 0), set("j", 1), repeat(SLOTS, [cloneMyself(), change("j", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  B.script(whenClicked(), [ifThen(eq(v("isClone"), 1), [set("pickQ", v("j"))])], 20, 220);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(lt(item("slotY", v("j")), 9000), [
      cond([
        [eq(bub.get("sel", v("j")), 1), [costume("sel")]],
        [eq(bub.get("kind", v("j")), GOLD), [costume("gold")]],
        [eq(bub.get("kind", v("j")), RAINBOW), [costume("rainbow")]],
      ], [costume("plain")]),
      goto(add(item("slotX", v("j")), v("shakeX")), add(item("slotY", v("j")), v("shakeY"))), show(),
    ], [hide()]),
  ])], 20, 300);
  return B;
}

// ---------------------------------------------------------------- Fish: they swim by in the background
function fishScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "speed");
  const d = dsl(B);
  const { v, mul, eq, gt, set, ifThen, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, random,
    changeX, setSize, setEffect, xPos, costumeTo } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0),
    repeat(5, [goto(random(-240, 240), random(-120, 110)), set("speed", random(4, 12)), cloneMyself()])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), costumeTo(random(1, 3)), setSize(mul(v("speed"), 9)), setEffect("GHOST", 35),
    d.back(9), show()], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [changeX(mul(v("speed"), 0.12)),
    ifThen(gt(xPos(), 250), [goto(-260, random(-120, 110)), costumeTo(random(1, 3))])])], 20, 260);
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
// A click on any other sprite (the flash covers everything for a moment) also looks for the bubble under the mouse.
const tappable = (B: Blocks) => { const d = dsl(B); B.script(d.whenClicked(), [d.broadcast("sea click")], 300, 20); return B; };

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Fish", { blocks: fishScripts(), costumes: A.fish, layer: 1, visible: false }),
    P.sprite("Bubble", { blocks: bubbleScripts(), costumes: A.bubble, layer: 2, visible: false }),
    P.sprite("Hud", { blocks: tappable(hudScripts()), costumes: A.hud, layer: 3, x: 0, y: 157 }),
    P.sprite("Heart", { blocks: tappable(heartScripts()), costumes: A.heart, layer: 4, visible: false }),
    P.sprite("Spark", { blocks: sparkScripts(P), costumes: sparkCostumes(P), layer: 5, visible: false }),
    P.sprite("Text", { blocks: textScripts(P), costumes: textCostumes(P, "number-bonds-pop"), layer: 6, visible: false }),
    P.sprite("Flash", { blocks: tappable(flashScripts()), costumes: A.flash, layer: 7, visible: false }),
  ],
  listValues: {
    ...kitLists(),
    slotX: Array(SLOTS).fill(0), slotY: Array(SLOTS).fill(9999),
    ...Object.fromEntries(FIELDS.map(f => [`bub.${f}`, Array(SLOTS).fill(0)])),
  },
  shown: [],
});
writeFileSync(new URL("number-bonds-pop.sb3", import.meta.url), sb3);
console.log(`number-bonds-pop.sb3: ${sb3.length} bytes`);
