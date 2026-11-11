// Builds number-blaster.sb3: a maths arcade game. Sums fall like meteors; click the answer pad with the right answer
// before they reach the city's shield. The first game of the maths series: it uses the math kit (sprite font, particles).
//
// State lives in lists: slot 1..3 is a meteor (slotActive, slotX, slotY, slotAns, slotSpeed), pad 1..4 is an answer
// pad (padValue, padState). The Stage runs the game: every frame it moves the meteors, spawns new ones, rolls the
// score display, then broadcasts `tick` for everything that draws. Points: (100 × level + speed bonus) × multiplier,
// where the multiplier grows with the streak of right answers (1, 2, 3, 5, 8). Levels change the kind of sums.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { textCostumes, textScripts, sparkCostumes, sparkScripts, kitLists, write, clear, pulse, emit } from "../math-kit/kit.ts";
import { art } from "./art.ts";

const P = new Project();
type D = ReturnType<typeof dsl>;
const SLOTS = 3, PADS = 4;
const PAD_X = [-168, -56, 56, 168], PAD_Y = -150;
const LANE_X = [-140, 0, 140], TOP = 215, GROUND = -95;
// Text groups.
const G = { score: 1, mult: 2, levelWord: 3, levelNum: 4, banner: 5, bannerNum: 6, stars: 7, title1: 8, title2: 9,
  click: 10, best: 11, bestWord: 12, pop: 13, bonusWord: 14, pad: 20, slot: 30 };

// ---------------------------------------------------------------- Stage: the game
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, or, and, not, join, set, change, ifThen, ifElse, repeat, until, whenFlag,
    whenReceive, whenStageClicked, forever, broadcast, wait, random, item, replace, contains, define, call, round, floor,
    ceiling, mod } = d;
  const arg = (n: string) => d.arg(n);
  const slot = (list: string, s: In) => item(list, s);

  B.script(whenFlag(), [
    set("phase", "title"), set("shake", 0), set("frame", 0), set("score", 0), set("shown", 0), set("lives", 3),
    set("level", 1), set("mult", 1),
    call("title screen"),
    forever([
      change("frame", 1),
      // Screen shake: a random wobble that dies down.
      set("shake", mul(v("shake"), 0.85)), ifThen(lt(v("shake"), 0.4), [set("shake", 0)]),
      set("shakeX", random(mul(v("shake"), -1), v("shake"))), set("shakeY", random(mul(v("shake"), -1), v("shake"))),
      ifThen(eq(v("phase"), "play"), [call("play")]),
      ifThen(or(eq(v("phase"), "title"), eq(v("phase"), "over")), [
        // The title words shimmer through the colours; "click to play" blinks.
        replace("groupColor", G.title1, mul(v("frame"), 3)), replace("groupColor", G.title2, mul(v("frame"), 3)),
        ifThen(eq(mod(v("frame"), 20), 0), [pulse(d, G.click, 18)]),
      ]),
      call("roll score"),
      broadcast("tick"),
    ]),
  ], 20, 20);
  B.script(whenStageClicked(), [ifThen(or(eq(v("phase"), "title"), eq(v("phase"), "ready")), [call("new game")])], 20, 520);

  define("title screen", [
    ...write(d, { text: "word-title1", x: 0, y: 95, size: 120, group: G.title1 }),
    ...write(d, { text: "word-title2", x: 0, y: 38, size: 140, group: G.title2 }),
    ...write(d, { text: "word-clickplay", x: 0, y: -50, size: 60, group: G.click }),
    ifThen(gt(v("best"), 0), [
      ...write(d, { text: "word-best", x: -40, y: 140, size: 34, group: G.bestWord }),
      ...write(d, { text: v("best"), x: 50, y: 140, size: 40, group: G.best }),
    ]),
  ], { warp: true, x: 520, y: 20 });

  define("new game", [
    ...[G.title1, G.title2, G.click, G.best, G.bestWord, G.banner, G.bannerNum, G.stars, G.bonusWord, G.mult].map(g => clear(d, g)),
    set("score", 0), set("shown", -1), set("lives", 3), set("level", 1), set("streak", 0), set("mult", 1),
    broadcast("shields"),
    call("start level"),
  ], { warp: true, x: 520, y: 400 });

  define("start level", [
    set("spawned", 0), set("hits", 0), set("misses", 0), set("spawnWait", 50),
    set("goal", add(7, v("level"))),
    set("maxActive", 2), ifThen(gt(v("level"), 2), [set("maxActive", 3)]),
    set("s", 1), repeat(SLOTS, [replace("slotActive", v("s"), 0), clear(d, add(G.slot, v("s"))), change("s", 1)]),
    ...write(d, { text: "word-level", x: 50, y: 158, size: 32, group: G.levelWord }),
    ...write(d, { text: v("level"), x: 112, y: 158, size: 40, group: G.levelNum }),
    // A big "LEVEL 3" banner to start.
    ...write(d, { text: "word-level", x: -30, y: 40, size: 100, group: G.banner }),
    ...write(d, { text: v("level"), x: 110, y: 40, size: 120, group: G.bannerNum }),
    pulse(d, G.banner, 40), pulse(d, G.bannerNum, 60), set("bannerTime", 50),
    set("p", 1), repeat(PADS, [replace("padValue", v("p"), ""), change("p", 1)]), call("deal pads"),
    set("phase", "play"),
  ], { warp: true, x: 520, y: 800 });

  // ---------------------------------------------------------------- every frame while playing
  define("play", [
    // The start-of-level banner goes after a while.
    ifThen(gt(v("bannerTime"), 0), [change("bannerTime", -1), ifThen(eq(v("bannerTime"), 0), [clear(d, G.banner), clear(d, G.bannerNum)])]),
    // Meteors fall; one that reaches the shield line lands.
    set("s", 1),
    repeat(SLOTS, [
      ifThen(eq(slot("slotActive", v("s")), 1), [
        replace("slotY", v("s"), sub(slot("slotY", v("s")), slot("slotSpeed", v("s")))),
        ifThen(lt(slot("slotY", v("s")), GROUND), [call("land %s", v("s"))]),
      ]),
      change("s", 1),
    ]),
    // New meteors, until the level's goal is reached.
    change("spawnWait", -1),
    set("active", 0), set("s", 1), repeat(SLOTS, [change("active", slot("slotActive", v("s"))), change("s", 1)]),
    ifThen(and(and(lt(v("spawnWait"), 1), lt(v("active"), v("maxActive"))), lt(v("spawned"), v("goal"))), [
      set("free", 0), set("s", 1),
      repeat(SLOTS, [ifThen(and(eq(v("free"), 0), eq(slot("slotActive", v("s")), 0)), [set("free", v("s"))]), change("s", 1)]),
      ifThen(gt(v("free"), 0), [call("spawn %s", v("free"))]),
      set("spawnWait", random(70, 110)), ifThen(gt(v("level"), 3), [set("spawnWait", random(45, 80))]),
    ]),
    // Level cleared: every meteor of the level is gone.
    ifThen(and(eq(v("spawned"), v("goal")), eq(v("active"), 0)), [set("phase", "levelup"), broadcast("level done")]),
  ], { warp: true, x: 1000, y: 20 });

  // ---------------------------------------------------------------- a new sum
  define("make sum", [
    set("kind", 1),
    ifThen(eq(v("level"), 2), [set("kind", 2)]),
    ifThen(eq(v("level"), 3), [set("kind", random(1, 2))]),
    ifThen(eq(v("level"), 4), [set("kind", 3)]), ifThen(eq(v("level"), 5), [set("kind", 4)]),
    ifThen(eq(v("level"), 6), [set("kind", 5)]), ifThen(gt(v("level"), 6), [set("kind", random(1, 5))]),
    set("big", lt(2, v("level"))),
    ifThen(eq(v("kind"), 1), [   // +
      ifElse(eq(v("big"), "true"), [set("a", random(10, 40)), set("b", random(2, 9))], [set("a", random(1, 8)), set("b", random(1, 7))]),
      set("ans", add(v("a"), v("b"))), set("sym", "+")]),
    ifThen(eq(v("kind"), 2), [   // −
      ifElse(eq(v("big"), "true"), [set("a", random(11, 40)), set("b", random(2, 9))], [set("a", random(5, 15)), set("b", random(1, sub(v("a"), 1)))]),
      set("ans", sub(v("a"), v("b"))), set("sym", "−")]),
    ifThen(eq(v("kind"), 3), [   // × 2, 5, 10
      set("a", item("easyTables", random(1, 3))), set("b", random(1, 10)), set("ans", mul(v("a"), v("b"))), set("sym", "×")]),
    ifThen(eq(v("kind"), 4), [   // × up to 10
      set("a", random(2, 10)), set("b", random(2, 10)), set("ans", mul(v("a"), v("b"))), set("sym", "×")]),
    ifThen(eq(v("kind"), 5), [   // ÷
      set("b", random(2, 10)), set("ans", random(2, 10)), set("a", mul(v("b"), v("ans"))), set("sym", "÷")]),
    set("sum", join(v("a"), join(v("sym"), v("b")))),
  ], { warp: true, x: 1000, y: 700 });

  define("spawn %s", [
    // A sum whose answer isn't already falling (so every pad means one meteor).
    set("tries", 0), call("make sum"),
    until(or(gt(v("tries"), 12), not(contains("activeAns", v("ans")))), [call("make sum"), change("tries", 1)]),
    replace("slotActive", arg("s"), 1), replace("slotAns", arg("s"), v("ans")),
    replace("slotX", arg("s"), add(item("laneX", arg("s")), random(-25, 25))), replace("slotY", arg("s"), TOP),
    replace("slotSpeed", arg("s"), add(add(0.55, mul(v("level"), 0.12)), random(0, 0.2))),
    ...write(d, { text: v("sum"), x: 0, y: 0, size: 46, group: add(G.slot, arg("s")), mode: "follow", follow: arg("s") }),
    change("spawned", 1),
    call("deal pads"),
  ], { warp: true, args: ["s"], x: 1000, y: 1500 });

  // ---------------------------------------------------------------- the answer pads
  // Every falling answer is on a pad; pads that are still needed keep their number; the others get decoys near the
  // real answers.
  define("deal pads", [
    d.deleteAll("activeAns"), set("s", 1),
    repeat(SLOTS, [ifThen(eq(slot("slotActive", v("s")), 1), [d.addTo("activeAns", slot("slotAns", v("s")))]), change("s", 1)]),
    d.deleteAll("oldPads"), set("p", 1), repeat(PADS, [d.addTo("oldPads", item("padValue", v("p"))), change("p", 1)]),
    // Free the pads that aren't needed (or that repeat a number).
    set("p", 1),
    repeat(PADS, [
      set("val", item("padValue", v("p"))),
      ifThen(or(not(contains("activeAns", v("val"))), lt(d.itemNum("padValue", v("val")), v("p"))), [replace("padValue", v("p"), "")]),
      change("p", 1),
    ]),
    // Put every needed answer on a free pad.
    set("i", 1),
    repeat(d.length("activeAns"), [
      ifThen(not(contains("padValue", item("activeAns", v("i")))), [
        set("p", random(1, PADS)), until(eq(item("padValue", v("p")), ""), [set("p", add(mod(v("p"), PADS), 1))]),
        replace("padValue", v("p"), item("activeAns", v("i"))),
      ]),
      change("i", 1),
    ]),
    // Decoys: close to a real answer, never below 0, never twice.
    set("p", 1),
    repeat(PADS, [
      ifThen(eq(item("padValue", v("p")), ""), [
        set("tries", 0),
        until(or(gt(v("tries"), 20), not(eq(item("padValue", v("p")), ""))), [
          ifElse(gt(d.length("activeAns"), 0), [set("val", add(item("activeAns", random(1, d.length("activeAns"))), random(-4, 4)))],
            [set("val", random(1, 20))]),
          ifThen(and(not(lt(v("val"), 0)), not(contains("padValue", v("val")))), [replace("padValue", v("p"), v("val"))]),
          change("tries", 1),
        ]),
      ]),
      change("p", 1),
    ]),
    // Write the pads whose number changed.
    set("p", 1),
    repeat(PADS, [
      ifThen(not(eq(item("padValue", v("p")), item("oldPads", v("p")))), [
        ...write(d, { text: item("padValue", v("p")), x: item("padX", v("p")), y: PAD_Y, size: 56, group: add(G.pad, v("p")) }),
        pulse(d, add(G.pad, v("p")), 30),
      ]),
      change("p", 1),
    ]),
  ], { warp: true, x: 1500, y: 20 });

  // ---------------------------------------------------------------- answers
  // (A custom block without screen refresh: a plain script's loop would pause, and the game loop shares `s`.)
  B.script(whenReceive("pad"), [call("answer")], 20, 640);
  define("answer", [
    ifThen(or(eq(v("phase"), "title"), eq(v("phase"), "ready")), [call("new game")]),
    ifThen(eq(v("phase"), "play"), [
      set("val", item("padValue", v("pressed"))), set("target", 0), set("s", 1),
      // The lowest meteor with this answer.
      repeat(SLOTS, [
        ifThen(and(eq(slot("slotActive", v("s")), 1), eq(slot("slotAns", v("s")), v("val"))), [
          ifThen(or(eq(v("target"), 0), lt(slot("slotY", v("s")), slot("slotY", v("target")))), [set("target", v("s"))]),
        ]),
        change("s", 1),
      ]),
      ifElse(gt(v("target"), 0), [call("hit %s", v("target"))], [call("miss")]),
    ]),
  ], { warp: true, x: 2500, y: 20 });

  // A click on a pad's number counts as a click on the pad.
  B.script(whenReceive("text click"), [
    ifThen(and(gt(v("clickedGroup"), G.pad), lt(v("clickedGroup"), G.pad + PADS + 1)), [
      set("pressed", sub(v("clickedGroup"), G.pad)), broadcast("pad")]),
  ], 20, 1100);

  define("hit %s", [
    set("hx", slot("slotX", arg("s"))), set("hy", slot("slotY", arg("s"))),
    replace("slotActive", arg("s"), 0), clear(d, add(G.slot, arg("s"))), change("hits", 1),
    // The streak makes the multiplier: 3 in a row x2, 6 x3, 10 x5, 15 x8.
    change("streak", 1), set("oldMult", v("mult")), set("mult", 1),
    ifThen(gt(v("streak"), 2), [set("mult", 2)]), ifThen(gt(v("streak"), 5), [set("mult", 3)]),
    ifThen(gt(v("streak"), 9), [set("mult", 5)]), ifThen(gt(v("streak"), 14), [set("mult", 8)]),
    // Hit it high up: a speed bonus.
    set("speedBonus", round(mul(div(sub(v("hy"), GROUND), TOP - GROUND), mul(100, v("level"))))),
    ifThen(lt(v("speedBonus"), 0), [set("speedBonus", 0)]),
    set("points", mul(add(mul(100, v("level")), v("speedBonus")), v("mult"))),
    change("score", v("points")),
    // Fireworks: laser, debris, sparks, a shock ring, a shake, and the points floating up.
    set("laserX", item("padX", v("pressed"))), broadcast("laser"),
    ...emit(d, "debris", v("hx"), v("hy"), 14), ...emit(d, "spark", v("hx"), v("hy"), 10), ...emit(d, "ring", v("hx"), v("hy"), 1),
    set("shake", 6), replace("padState", v("pressed"), 1),
    ...write(d, { text: join("+", v("points")), x: v("hx"), y: add(v("hy"), 10), size: 44, group: G.pop, mode: "float", replace: false }),
    ifThen(gt(v("speedBonus"), mul(60, v("level"))), [
      ...write(d, { text: "word-great", x: v("hx"), y: add(v("hy"), 46), size: 40, group: G.pop, mode: "float", replace: false })]),
    ifThen(gt(v("mult"), v("oldMult")), [
      ...write(d, { text: "word-combo", x: -40, y: 30, size: 80, group: G.pop, mode: "float", replace: false }),
      ...write(d, { text: join("x", v("mult")), x: 105, y: 30, size: 90, group: G.pop, mode: "float", replace: false }),
      ...emit(d, "spark", 0, 30, 16),
    ]),
    ifThen(gt(v("mult"), 1), [
      ...write(d, { text: join("x", v("mult")), x: -40, y: 158, size: 46, group: G.mult }), pulse(d, G.mult, 50),
      replace("groupColor", G.mult, mul(v("mult"), 25)),
    ]),
    call("deal pads"),
  ], { warp: true, args: ["s"], x: 2000, y: 20 });

  define("miss", [
    set("streak", 0), set("mult", 1), clear(d, G.mult), change("misses", 1), set("shake", 3),
    replace("padState", v("pressed"), 2),
    ...write(d, { text: "word-oops", x: item("padX", v("pressed")), y: PAD_Y + 50, size: 40, group: G.pop, mode: "float", replace: false }),
  ], { warp: true, x: 2000, y: 900 });

  define("land %s", [
    set("hx", slot("slotX", arg("s"))),
    replace("slotActive", arg("s"), 0), clear(d, add(G.slot, arg("s"))),
    change("lives", -1), change("misses", 1), set("streak", 0), set("mult", 1), clear(d, G.mult),
    ...emit(d, "debris", v("hx"), GROUND, 20), ...emit(d, "smoke", v("hx"), GROUND, 8), ...emit(d, "ring", v("hx"), GROUND, 1),
    set("shake", 14), set("flashKind", "red"), broadcast("flash"), broadcast("shields"),
    ...write(d, { text: "word-shield", x: v("hx"), y: GROUND + 40, size: 40, group: G.pop, mode: "float", replace: false }),
    call("deal pads"),
    ifThen(lt(v("lives"), 1), [set("phase", "over"), broadcast("game over")]),
  ], { warp: true, args: ["s"], x: 2000, y: 1300 });

  // ---------------------------------------------------------------- level cleared: stars, bonus, confetti
  B.script(whenReceive("level done"), [
    ...write(d, { text: "word-levelup", x: 0, y: 95, size: 110, group: G.banner }), pulse(d, G.banner, 60),
    set("flashKind", "white"), broadcast("flash"), set("shake", 5),
    set("c", 0), repeat(6, [...emit(d, "confetti", random(-220, 220), 190, 8), change("c", 1)]),
    // Stars: 3 for a perfect level, 2 for up to 2 misses, else 1.
    set("starCount", 1), ifThen(lt(v("misses"), 3), [set("starCount", 2)]), ifThen(eq(v("misses"), 0), [set("starCount", 3)]),
    set("stars", ""),
    repeat(v("starCount"), [
      wait(0.35), set("stars", join(v("stars"), "★")),
      ...write(d, { text: v("stars"), x: 0, y: 30, size: 90, group: G.stars }), pulse(d, G.stars, 50),
      ...emit(d, "spark", 0, 30, 12), set("shake", 4),
    ]),
    // The bonus: 500 × level for every shield left, doubled for a perfect level, counted up.
    set("bonus", mul(mul(v("lives"), 500), v("level"))),
    ifThen(eq(v("misses"), 0), [set("bonus", mul(v("bonus"), 2)),
      ...write(d, { text: "word-perfect", x: 0, y: -100, size: 80, group: G.pop, mode: "float", replace: false })]),
    wait(0.4),
    ...write(d, { text: "word-bonus", x: -70, y: -40, size: 60, group: G.bonusWord }),
    set("shownBonus", 0),
    repeat(20, [
      change("shownBonus", ceiling(div(v("bonus"), 20))), ifThen(gt(v("shownBonus"), v("bonus")), [set("shownBonus", v("bonus"))]),
      ...write(d, { text: v("shownBonus"), x: 70, y: -40, size: 64, group: G.bannerNum }), pulse(d, G.bannerNum, 12),
      wait(0.03),
    ]),
    change("score", v("bonus")),
    wait(1.6),
    ...[G.banner, G.bannerNum, G.stars, G.bonusWord].map(g => clear(d, g)),
    change("level", 1), call("start level"),
  ], 20, 760);

  // ---------------------------------------------------------------- game over
  B.script(whenReceive("game over"), [
    set("s", 1), repeat(SLOTS, [
      ifThen(eq(slot("slotActive", v("s")), 1), [...emit(d, "debris", slot("slotX", v("s")), slot("slotY", v("s")), 10)]),
      replace("slotActive", v("s"), 0), clear(d, add(G.slot, v("s"))), change("s", 1)]),
    ...write(d, { text: "word-gameover", x: 0, y: 80, size: 110, group: G.banner }), pulse(d, G.banner, 40),
    ...write(d, { text: v("score"), x: 0, y: 10, size: 100, group: G.bannerNum }),
    ifThen(gt(v("score"), v("best")), [set("best", v("score")),
      ...write(d, { text: "word-best", x: 0, y: -45, size: 60, group: G.bestWord }), pulse(d, G.bestWord, 50),
      repeat(4, [...emit(d, "confetti", random(-200, 200), 190, 10)])]),
    wait(2),
    ...write(d, { text: "word-clickplay", x: 0, y: -100, size: 60, group: G.click }),
    set("phase", "ready"),
  ], 20, 1200);

  // ---------------------------------------------------------------- the score display rolls up to the score
  define("roll score", [
    ifThen(and(not(eq(v("shown"), v("score"))), not(eq(v("phase"), "title"))), [
      ifElse(lt(v("shown"), 0), [set("shown", 0)], [change("shown", ceiling(div(sub(v("score"), v("shown")), 6)))]),
      ifThen(gt(v("shown"), v("score")), [set("shown", v("score"))]),
      ...write(d, { text: v("shown"), x: -150, y: 158, size: 52, group: G.score }), pulse(d, G.score, 14),
    ]),
  ], { warp: true, x: 1500, y: 1700 });
  void floor; void wait; void until;
  return B;
}

// ---------------------------------------------------------------- Meteor: three clones, one per slot
function meteorScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "slot");
  const d = dsl(B);
  const { v, add, eq, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, item, mod } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("slot", 1), repeat(SLOTS, [cloneMyself(), change("slot", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1)], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(eq(item("slotActive", v("slot")), 1), [
      goto(add(item("slotX", v("slot")), v("shakeX")), add(item("slotY", v("slot")), v("shakeY"))), show(),
      // A trail of embers.
      ifThen(eq(mod(add(v("frame"), v("slot")), 3), 0), [...emit(d, "ember", add(item("slotX", v("slot")), d.random(-12, 12)), add(item("slotY", v("slot")), 40), 1)]),
    ], [hide()]),
  ])], 20, 240);
  return B;
}

// ---------------------------------------------------------------- Pad: four answer buttons
function padScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "idx", "glow");
  const d = dsl(B);
  const { v, add, gt, eq, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, whenClicked, hide, show,
    goto, cloneMyself, item, replace, costume, setSize, changeSize, broadcast, size } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("idx", 1),
    repeat(PADS, [goto(item("padX", v("idx")), PAD_Y), cloneMyself(), change("idx", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), set("glow", 0), costume("pad"), setSize(100), show()], 20, 200);
  B.script(whenClicked(), [ifThen(eq(v("isClone"), 1), [set("pressed", v("idx")), setSize(118), broadcast("pad")])], 20, 300);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    goto(add(item("padX", v("idx")), v("shakeX")), add(PAD_Y, v("shakeY"))),
    ifThen(gt(size(), 100), [changeSize(-3)]),
    // Green for a hit, red for a miss, for a moment.
    ifThen(gt(item("padState", v("idx")), 0), [
      ifElse(eq(item("padState", v("idx")), 1), [costume("good")], [costume("bad")]),
      replace("padState", v("idx"), 0), set("glow", 10)]),
    ifThen(gt(v("glow"), 0), [change("glow", -1), ifThen(eq(v("glow"), 0), [costume("pad")])]),
  ])], 20, 420);
  return B;
}

// ---------------------------------------------------------------- Laser, Flash, Shields, Stars
function laserScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, sub, add, mul, set, ifThen, gt, whenFlag, whenReceive, hide, show, goto, point, setSize, setEffect, sqrt, atan, div } = d;
  B.script(whenFlag(), [hide()], 20, 20);
  B.script(whenReceive("laser"), [
    set("dx", sub(v("hx"), v("laserX"))), set("dy", sub(v("hy"), PAD_Y + 20)),
    goto(v("laserX"), PAD_Y + 20), point(atan(div(v("dx"), v("dy")))),
    setSize(sqrt(add(mul(v("dx"), v("dx")), mul(v("dy"), v("dy"))))), setEffect("GHOST", 0), show(), d.front(),
  ], 20, 100);
  // The beam fades out in a few frames.
  B.script(whenReceive("tick"), [d.changeEffect("GHOST", 22)], 20, 300);
  void ifThen; void gt;
  return B;
}
function flashScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.hide()], 20, 20);
  B.script(d.whenReceive("flash"), [d.costumeTo(d.v("flashKind")), d.setEffect("GHOST", 45), d.show(), d.front()], 20, 100);
  B.script(d.whenReceive("tick"), [d.changeEffect("GHOST", 9)], 20, 220);
  return B;
}
function shieldScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "idx");
  const d = dsl(B);
  const { v, eq, gt, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, costume, add, mul } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("idx", 1), repeat(3, [goto(add(150, mul(v("idx"), 26)), 160), cloneMyself(), change("idx", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), costume("ok"), show()], 20, 160);
  B.script(whenReceive("shields"), [ifThen(eq(v("isClone"), 1), [ifElse(gt(v("idx"), v("lives")), [costume("lost")], [costume("ok")])])], 20, 240);
  void hide;
  return B;
}
function starScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "speed");
  const d = dsl(B);
  const { v, eq, lt, set, ifThen, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, random, changeY, setSize, setEffect, mul, add } = d;
  // A starfield in three depths: far stars are small, dim and slow.
  B.script(whenFlag(), [hide(), set("isClone", 0),
    repeat(45, [goto(random(-240, 240), random(-100, 180)), set("speed", random(1, 3)), cloneMyself()])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), setSize(mul(v("speed"), 45)), setEffect("GHOST", add(10, mul(30, d.sub(3, v("speed"))))), d.back(9), show()], 20, 160);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [changeY(mul(v("speed"), -0.25)),
    ifThen(lt(d.yPos(), -100), [goto(random(-240, 240), 180)])])], 20, 260);
  return B;
}

function hudScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, 157), d.show()], 20, 20);
  return B;
}

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Star", { blocks: starScripts(), costumes: A.star, layer: 1, visible: false }),
    P.sprite("Meteor", { blocks: meteorScripts(), costumes: A.meteor, layer: 2, visible: false }),
    P.sprite("Pad", { blocks: padScripts(), costumes: A.pad, layer: 3, visible: false }),
    P.sprite("Laser", { blocks: laserScripts(), costumes: A.laser, layer: 4, visible: false }),
    P.sprite("Hud", { blocks: hudScripts(), costumes: A.hud, layer: 4, x: 0, y: 157 }),
    P.sprite("Spark", { blocks: sparkScripts(P), costumes: sparkCostumes(P), layer: 5, visible: false }),
    P.sprite("Text", { blocks: textScripts(P), costumes: textCostumes(P), layer: 6, visible: false }),
    P.sprite("Shield", { blocks: shieldScripts(), costumes: A.shield, layer: 7, visible: false }),
    P.sprite("Flash", { blocks: flashScripts(), costumes: A.flash, layer: 8, visible: false }),
  ],
  listValues: {
    ...kitLists(),
    slotActive: [0, 0, 0], slotAns: [0, 0, 0], slotSpeed: [0, 0, 0], laneX: LANE_X,
    padValue: ["", "", "", ""], padState: [0, 0, 0, 0], padX: PAD_X, oldPads: [], activeAns: [], easyTables: [2, 5, 10],
  },
  shown: [],
});
writeFileSync(new URL("number-blaster.sb3", import.meta.url), sb3);
console.log(`number-blaster.sb3: ${sb3.length} bytes`);
