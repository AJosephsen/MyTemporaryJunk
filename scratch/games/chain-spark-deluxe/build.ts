// Builds chain-spark-deluxe.sb3: a fireworks puzzle in the spirit of a "build a machine" game. Each level has a fuse
// (where the show starts), a tray of fireworks and a target score. Build: drag fireworks into the sky, click one to
// turn it 45°, drag it back to the tray to take it away. TEST runs the show as often as you like (nothing counts);
// RESET puts everything back exactly as you placed it. GO is the real run: reach the target to clear the level.
// A burning firework sets off every firework its sparks touch. Scoring: every frame, each burning firework adds a
// point (a long, busy show scores most), plus a few points per firework, plus a FINALE! bonus if every one went off.
//
// Engine: one update per frame on the Stage, on records that are fixed pools: fw (placed fireworks: position, home
// position for RESET, state) and sp (sparks). The Firework, Spark and tray sprites have one clone per row and only draw.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { record } from "../../lib/records.ts";
import { textCostumes, textScripts, sparkCostumes, sparkScripts, kitLists, write, clear, pulse, emit } from "../math-kit/kit.ts";
import { art, KINDS, SKIES } from "./art.ts";

const P = new Project();
type D = ReturnType<typeof dsl>;
export const FW = 16, SP = 140;
export const SKY_MIN_Y = -118, TRAY_Y = -160, TRAY_TOP = -138, PICK_R = 20, HIT = 15;
export const SLOT_X = KINDS.map((_, i) => -205 + i * 60);
export const BUTTON_X = [150, 208], BUTTON_Y = TRAY_Y, BUTTON_W = 26, BUTTON_H = 15;
// Points when a firework goes off (rockets few: they are the fuses).
export const POINTS: Record<string, number> = { rocket: 5, shell: 30, fountain: 20, crossette: 25, willow: 25, spinner: 20 };
export const FINALE = 200, SHOW_POINTS = 2, STAR2 = 1.25, STAR3 = 1.5;
// Levels: [sky, fuse x, fuse y, target, counts per kind (rocket, shell, fountain, crossette, willow, spinner)].
// Each level brings one new kind (shown with "NEW!" at the start). Targets: about 85% of what a simple chain scores
// (see the test "every level can be beaten"); a well spread-out show does better.
export const LEVELS: [string, number, number, number, number[]][] = [
  ["dusk", -200, -100, 600, [2, 3, 1, 0, 0, 0]],
  ["dusk", 0, -105, 450, [2, 2, 0, 2, 0, 0]],          // crossette
  ["midnight", 200, -100, 650, [1, 2, 1, 1, 2, 0]],     // willow
  ["midnight", -200, 110, 1000, [2, 1, 1, 1, 1, 2]],     // spinner
  ["aurora", 0, 40, 1350, [2, 2, 2, 2, 2, 2]],          // everything
];
export const NEW_KIND = [0, 4, 5, 6, 0];   // the kind each level introduces (0: none)
const G = { score: 1, levelWord: 2, levelNum: 3, targetWord: 4, targetNum: 5, banner: 6, bannerNum: 7, title1: 8, title2: 9,
  click: 10, b1: 11, b2: 12, pop: 13, mode: 14, stars: 15, best: 16, slot: 20 };   // slot k: 20 + k
const fwRec = (d: D) => record(d, "fw", ["on", "kind", "x", "y", "dir", "hx", "hy", "hdir", "st", "t", "a"] as const);
const spRec = (d: D) => record(d, "sp", ["on", "x", "y", "vx", "vy", "life", "col", "kind"] as const);
const K = Object.fromEntries(KINDS.map((k, i) => [k, i + 1])) as Record<string, number>;

// ---------------------------------------------------------------- Stage: the game
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, or, and, not, join, set, change, ifThen, ifElse, repeat, until, whenFlag,
    whenReceive, forever, broadcast, wait, random, replace, define, call, ceiling, floor, round, mod, abs, sin, cos, sqrt,
    switchBackdrop, arg, cond, choose, max, min, clamp, mouseX, mouseY, mouseDown, item, length } = d;
  const fw = fwRec(d), sp = spRec(d);
  const F = (f: Parameters<typeof fw.get>[0]) => fw.get(f, v("i"));
  const S = (f: Parameters<typeof sp.get>[0]) => sp.get(f, v("j"));

  B.script(whenFlag(), [
    set("phase", "title"), set("frame", 0), set("hideAbove", 400), set("score", 0), set("shown", 0), set("level", 1),
    set("pressQ", 0), set("drag", 0), set("burning", 0), set("sparks", 0), set("shake", 0), set("best", 0), set("flash", 0),
    call("clear all"), switchBackdrop(SKIES[0]),
    call("title screen"),
    forever([
      change("frame", 1),
      set("shake", mul(v("shake"), 0.85)), ifThen(lt(v("shake"), 0.4), [set("shake", 0)]),
      set("shakeX", random(mul(v("shake"), -1), v("shake"))), set("shakeY", random(mul(v("shake"), -1), v("shake"))),
      set("press", v("pressQ")), set("pressQ", 0),
      set("flash", mul(v("flash"), 0.85)),
      cond([
        [eq(v("phase"), "build"), [call("build")]],
        [or(eq(v("phase"), "test"), eq(v("phase"), "go")), [call("show")]],
        [eq(v("phase"), "tested"), [ifThen(eq(v("press"), 1), [
          // After a test: GO runs for real (from the same layout); any other click resets.
          ifElse(eq(v("hitButton"), 2), [call("reset"), call("start show %s", "go")], [call("reset")])])]],
        [or(eq(v("phase"), "title"), eq(v("phase"), "ready")), [
          replace("groupColor", G.title1, mul(v("frame"), 3)), replace("groupColor", G.title2, mul(v("frame"), 3)),
          ifThen(eq(mod(v("frame"), 20), 0), [pulse(d, G.click, 18)]),
          ifThen(eq(v("press"), 1), [call("start level")]),
        ]],
      ]),
      call("move sparks"),
      call("roll score"),
      broadcast("tick"),
    ]),
  ], 20, 20);
  // Input: every click is remembered with its position (and which button, if any); dragging reads "mouse down?".
  // (No loop here: outside a warp block a loop waits a frame between passes, and the frame would take the press first.)
  const onButton = (b: number) => and(lt(abs(sub(mouseX(), BUTTON_X[b])), BUTTON_W + 4), lt(abs(sub(mouseY(), BUTTON_Y)), BUTTON_H + 4));
  const pressAt = [set("pressX", mouseX()), set("pressY", mouseY()),
    set("hitButton", 0), ifThen(onButton(0), [set("hitButton", 1)]), ifThen(onButton(1), [set("hitButton", 2)]),
    set("pressQ", 1)];
  B.script(d.whenStageClicked(), pressAt, 20, 900);
  B.script(whenReceive("text click"), pressAt, 20, 1000);
  B.script(whenReceive("other click"), pressAt, 20, 1100);
  B.script(d.whenKey("space"), [set("pressX", 999), set("pressY", 999), set("hitButton", 1), set("pressQ", 1)], 20, 1200);

  define("clear all", [
    set("i", 1), repeat(FW, [fw.set("on", v("i"), 0), change("i", 1)]),
    set("j", 1), repeat(SP, [sp.set("on", v("j"), 0), change("j", 1)]), set("sparks", 0), set("burning", 0),
  ], { warp: true, x: 560, y: 1500 });

  define("title screen", [
    ...write(d, { text: "word-cs1", x: 0, y: 80, size: 110, group: G.title1 }),
    ...write(d, { text: "word-cs2", x: 0, y: 25, size: 120, group: G.title2 }),
    ...write(d, { text: "word-clickplay", x: 0, y: -40, size: 50, group: G.click }),
  ], { warp: true, x: 560, y: 20 });

  // ---------------------------------------------------------------- levels
  define("start level", [
    ...[G.title1, G.title2, G.click, G.banner, G.bannerNum, G.mode, G.pop].flatMap(g => clear(d, g)),
    call("clear all"),
    set("L", add(mod(sub(v("level"), 1), LEVELS.length), 1)),
    switchBackdrop(item("lvSky", v("L"))),
    set("fuseX", item("lvFuseX", v("L"))), set("fuseY", item("lvFuseY", v("L"))), set("target", item("lvTarget", v("L"))),
    // The tray: how many of each kind.
    set("k", 1), repeat(KINDS.length, [replace("inv", v("k"), item("lvInv", add(mul(sub(v("L"), 1), KINDS.length), v("k")))), change("k", 1)]),
    call("write tray"),
    ...write(d, { text: "word-level", x: 110, y: 162, size: 26, group: G.levelWord }),
    ...write(d, { text: v("level"), x: 160, y: 162, size: 32, group: G.levelNum }),
    // The best stars for this level so far.
    ifElse(gt(item("lvStars", v("L")), 0), [...write(d, { text: item("starText", item("lvStars", v("L"))), x: 212, y: 162, size: 26, group: G.best })],
      [...clear(d, G.best)]),
    ...write(d, { text: "word-target", x: -20, y: 162, size: 26, group: G.targetWord }),
    ...write(d, { text: v("target"), x: 50, y: 162, size: 32, group: G.targetNum }),
    set("score", 0), set("shown", -1), set("phase", "build"), set("lit", 0), set("fuse", 0), call("buttons"),
    // A new kind of firework this level: "NEW!" next to it in the tray.
    set("newKind", item("lvNew", v("L"))),
    ifThen(gt(v("newKind"), 0), [...write(d, { text: "word-new", x: item("slotX", v("newKind")), y: TRAY_Y + 28, size: 30, group: G.mode }), pulse(d, G.mode, 50)]),
  ], { warp: true, x: 560, y: 400 });

  define("write tray", [
    set("k", 1), repeat(KINDS.length, [
      ifElse(gt(item("lvMax", add(mul(sub(v("L"), 1), KINDS.length), v("k"))), 0),
        [...write(d, { text: item("inv", v("k")), x: add(item("slotX", v("k")), 18), y: TRAY_Y - 8, size: 26, group: add(G.slot, v("k")) })],
        [...clear(d, add(G.slot, v("k")))]),
      change("k", 1)]),
  ], { warp: true, x: 560, y: 900 });

  // The two buttons: TEST (or RESET after a test) and GO.
  define("buttons", [
    cond([
      [eq(v("phase"), "build"), [...write(d, { text: "word-test", x: BUTTON_X[0], y: BUTTON_Y, size: 30, group: G.b1 }),
        ...write(d, { text: "word-go", x: BUTTON_X[1], y: BUTTON_Y, size: 30, group: G.b2 })]],
      [eq(v("phase"), "tested"), [...write(d, { text: "word-reset", x: BUTTON_X[0], y: BUTTON_Y, size: 26, group: G.b1 }),
        ...write(d, { text: "word-go", x: BUTTON_X[1], y: BUTTON_Y, size: 30, group: G.b2 })]],
    ], [...clear(d, G.b1), ...clear(d, G.b2)]),
    broadcast("buttons"),
  ], { warp: true, x: 560, y: 1200 });

  // ---------------------------------------------------------------- building
  define("build", [
    ifThen(eq(v("press"), 1), [cond([
      [eq(v("hitButton"), 1), [call("start show %s", "test")]],
      [eq(v("hitButton"), 2), [call("start show %s", "go")]],
    ], [call("grab %s %s", v("pressX"), v("pressY"))])]),
    ifThen(gt(v("drag"), 0), [
      ifElse(mouseDown(), [
        // Being dragged: it follows the mouse (and counts as moved once it has gone a few pixels).
        ifThen(gt(add(abs(sub(mouseX(), v("downX"))), abs(sub(mouseY(), v("downY")))), 4), [set("moved", 1)]),
        ifThen(eq(v("moved"), 1), [fw.set("x", v("drag"), clamp(mouseX(), -228, 228)), fw.set("y", v("drag"), clamp(mouseY(), -170, 150))]),
      ], [call("drop")]),
    ]),
    // The ring shows which firework is under the mouse.
    set("hover", 0), ifThen(eq(v("drag"), 0), [...[set("near", 0)], call("nearest %s %s", mouseX(), mouseY()), set("hover", v("near"))]),
  ], { warp: true, x: 1100, y: 20 });

  // The placed firework nearest to (x, y), within reach: "near" (or 0).
  define("nearest %s %s", [
    set("near", 0), set("nearD", PICK_R), set("i", 1),
    repeat(FW, [ifThen(eq(F("on"), 1), [
      set("dd", add(abs(sub(F("x"), arg("x"))), abs(sub(F("y"), arg("y"))))),
      ifThen(lt(v("dd"), v("nearD")), [set("near", v("i")), set("nearD", v("dd"))])]), change("i", 1)]),
  ], { args: ["x", "y"], warp: true, x: 1100, y: 600 });

  define("grab %s %s", [
    call("nearest %s %s", arg("x"), arg("y")),
    ifElse(gt(v("near"), 0), [set("drag", v("near")), set("moved", 0), set("downX", arg("x")), set("downY", arg("y"))], [
      // A tray slot: a new firework, if there are any left.
      ifThen(lt(arg("y"), TRAY_TOP), [set("k", 1), repeat(KINDS.length, [
        ifThen(and(lt(abs(sub(arg("x"), item("slotX", v("k")))), 26), gt(item("inv", v("k")), 0)), [
          set("s", fw.find("on", 0)),
          ifThen(gt(v("s"), 0), [
            fw.set("on", v("s"), 1), fw.set("kind", v("s"), v("k")), fw.set("x", v("s"), arg("x")), fw.set("y", v("s"), arg("y")),
            fw.set("dir", v("s"), 0), fw.set("st", v("s"), 0),
            replace("inv", v("k"), sub(item("inv", v("k")), 1)), call("write tray"),
            set("drag", v("s")), set("moved", 1), set("downX", arg("x")), set("downY", arg("y"))])]),
        change("k", 1)])]),
    ]),
  ], { args: ["x", "y"], warp: true, x: 1100, y: 900 });

  define("drop", [
    cond([
      // A click without a drag: turn it 45 degrees.
      [eq(v("moved"), 0), [fw.set("dir", v("drag"), mod(add(fw.get("dir", v("drag")), 45), 360))]],
      // Dropped on the tray: back in the box.
      [lt(fw.get("y", v("drag")), TRAY_TOP), [
        fw.set("on", v("drag"), 0), replace("inv", fw.get("kind", v("drag")), add(item("inv", fw.get("kind", v("drag"))), 1)), call("write tray")]],
    ], [fw.set("y", v("drag"), max(SKY_MIN_Y, fw.get("y", v("drag"))))]),
    set("drag", 0),
  ], { warp: true, x: 1100, y: 1500 });

  // ---------------------------------------------------------------- the show
  define("start show %s", [
    set("phase", arg("mode")), set("drag", 0), set("hover", 0), set("score", 0), set("shown", -1), set("showT", 0), set("lit", 0), set("placed", 0),
    // Remember the layout (RESET puts it back).
    set("i", 1), repeat(FW, [ifThen(eq(F("on"), 1), [fw.set("hx", v("i"), F("x")), fw.set("hy", v("i"), F("y")), fw.set("hdir", v("i"), F("dir")),
      fw.set("st", v("i"), 0), fw.set("t", v("i"), 0), change("placed", 1)]), change("i", 1)]),
    ifElse(eq(arg("mode"), "test"), [...write(d, { text: "word-test", x: 0, y: 125, size: 40, group: G.mode })],
      [...write(d, { text: "word-show", x: 0, y: 125, size: 40, group: G.mode })]),
    pulse(d, G.mode, 30), call("buttons"),
    // The fuse: a small burst where the show starts.
    set("fuse", 1), call("burst %s %s %s %s %s %s %s", v("fuseX"), add(v("fuseY"), 14), 8, 2.5, 18, "gold", 0),
  ], { args: ["mode"], warp: true, x: 1700, y: 20 });

  define("show", [
    change("showT", 1), ifThen(gt(v("showT"), 25), [set("fuse", 0)]),
    set("i", 1), repeat(FW, [ifThen(and(eq(F("on"), 1), eq(F("st"), 1)), [call("burn")]), change("i", 1)]),
    // Show time: every burning firework, every frame (counted double: a long, busy show is the point).
    change("score", mul(SHOW_POINTS, v("burning"))),
    ifThen(and(gt(v("showT"), 20), and(eq(v("burning"), 0), eq(v("sparks"), 0))), [call("show over")]),
  ], { warp: true, x: 1700, y: 500 });

  // One frame of a burning firework (row i).
  define("burn", [
    fw.change("t", v("i"), 1), set("ft", F("t")), set("fk", F("kind")),
    cond([
      [eq(v("fk"), K.rocket), [ifElse(lt(v("ft"), 45), [
        fw.change("x", v("i"), mul(6, sin(F("dir")))), fw.change("y", v("i"), mul(6, cos(F("dir")))),
        ifThen(eq(mod(v("ft"), 2), 0), [call("spark %s %s %s %s %s %s %s", F("x"), F("y"), add(add(F("dir"), 180), random(-15, 15)), 1.6, 14, "gold", 0)]),
        // Off the screen: it pops early.
        ifThen(or(gt(abs(F("x")), 235), or(gt(F("y"), 175), lt(F("y"), -175))), [fw.set("t", v("i"), 45)]),
      ], [call("burst %s %s %s %s %s %s %s", F("x"), F("y"), 10, 3.5, 22, "red", 0), call("done")])]],
      [eq(v("fk"), K.shell), [ifThen(eq(v("ft"), 12), [call("burst %s %s %s %s %s %s %s", F("x"), F("y"), 20, 4, 26, "purple", 0), set("shake", max(v("shake"), 3)), set("flash", max(v("flash"), 14)), call("done")])]],
      [eq(v("fk"), K.fountain), [ifElse(lt(v("ft"), 90), [
        call("spark %s %s %s %s %s %s %s", F("x"), F("y"), add(F("dir"), random(-18, 18)), random(3.8, 5), 20, "green", 0)], [call("done")])]],
      [eq(v("fk"), K.crossette), [ifThen(eq(v("ft"), 10), [
        set("q", 0), repeat(4, [call("spark %s %s %s %s %s %s %s", F("x"), F("y"), add(F("dir"), mul(90, v("q"))), 3.5, 18, "big-blue", 1), change("q", 1)]),
        call("done")])]],
      [eq(v("fk"), K.willow), [ifThen(eq(v("ft"), 14), [call("burst %s %s %s %s %s %s %s", F("x"), F("y"), 16, 2.2, 75, "gold", 2), set("flash", max(v("flash"), 10)), call("done")])]],
    ], [ifElse(lt(v("ft"), 130), [
      // Spinner: turns on the spot, throwing sparks.
      fw.change("a", v("i"), 23), fw.set("dir", v("i"), F("a")),
      call("spark %s %s %s %s %s %s %s", F("x"), F("y"), F("a"), 3.5, 16, "pink", 0)], [call("done")])]),
  ], { warp: true, x: 1700, y: 900 });

  define("done", [fw.set("st", v("i"), 2), change("burning", -1)], { warp: true, x: 1700, y: 2000 });

  define("ignite %s", [
    fw.set("st", arg("n"), 1), fw.set("t", arg("n"), 0), fw.set("a", arg("n"), fw.get("dir", arg("n"))), change("burning", 1), change("lit", 1),
    change("score", item("points", fw.get("kind", arg("n")))),
    ...emit(d, "ring", fw.get("x", arg("n")), fw.get("y", arg("n")), 1),
  ], { args: ["n"], warp: true, x: 1700, y: 2200 });

  define("show over", [
    ifThen(and(eq(v("lit"), v("placed")), gt(v("placed"), 2)), [change("score", FINALE),
      ...write(d, { text: "word-finale", x: 0, y: 60, size: 100, group: G.banner }), pulse(d, G.banner, 50),
      ...emit(d, "confetti", 0, 170, 20),
      call("burst %s %s %s %s %s %s %s", -140, 70, 18, 4.5, 30, "big-red", 0), call("burst %s %s %s %s %s %s %s", 0, 110, 18, 4.5, 30, "big-gold", 0),
      call("burst %s %s %s %s %s %s %s", 140, 70, 18, 4.5, 30, "big-green", 0), set("flash", 45), set("shake", 10)]),
    ifElse(eq(v("phase"), "test"), [
      // A test: what it would score. Then back to the same layout with RESET (or GO for real).
      set("phase", "tested"), call("buttons"),
      ...write(d, { text: "word-test", x: -50, y: 20, size: 70, group: G.bannerNum }),
    ], [set("phase", "result"), call("buttons"), broadcast("result")]),
  ], { warp: true, x: 1700, y: 2400 });

  define("reset", [
    ...[G.banner, G.bannerNum, G.mode].flatMap(g => clear(d, g)),
    set("i", 1), repeat(FW, [ifThen(eq(F("on"), 1), [fw.set("x", v("i"), F("hx")), fw.set("y", v("i"), F("hy")), fw.set("dir", v("i"), F("hdir")),
      fw.set("st", v("i"), 0), fw.set("t", v("i"), 0)]), change("i", 1)]),
    set("j", 1), repeat(SP, [sp.set("on", v("j"), 0), change("j", 1)]), set("sparks", 0), set("burning", 0),
    set("score", 0), set("shown", -1), set("fuse", 0), set("phase", "build"), call("buttons"),
  ], { warp: true, x: 1700, y: 2800 });

  B.script(whenReceive("result"), [
    ifElse(not(lt(v("score"), v("target"))), [
      ...write(d, { text: "word-welldone", x: 0, y: 40, size: 100, group: G.banner }), pulse(d, G.banner, 50),
      // Stars: 1 for the target, 2 for 25% more, 3 for 50% more.
      set("got", 1), ifThen(not(lt(v("score"), mul(v("target"), STAR2))), [set("got", 2)]), ifThen(not(lt(v("score"), mul(v("target"), STAR3))), [set("got", 3)]),
      ifThen(gt(v("got"), item("lvStars", v("L"))), [replace("lvStars", v("L"), v("got"))]),
      ...write(d, { text: item("starText", v("got")), x: 0, y: -25, size: 90, group: G.stars }), pulse(d, G.stars, 60),
      ...emit(d, "confetti", -150, 170, 15), ...emit(d, "confetti", 150, 170, 15),
      ifThen(gt(v("score"), v("best")), [set("best", v("score"))]),
      wait(3), ...clear(d, G.stars), change("level", 1), call("start level"),
    ], [
      ...write(d, { text: "word-tryagain", x: 0, y: 30, size: 90, group: G.banner }), pulse(d, G.banner, 40),
      wait(2), call("reset"),
    ]),
  ], 20, 2400);

  // ---------------------------------------------------------------- sparks
  define("spark %s %s %s %s %s %s %s", [
    set("s", sp.find("on", 0)),
    ifThen(gt(v("s"), 0), [
      sp.set("on", v("s"), 1), sp.set("x", v("s"), arg("x")), sp.set("y", v("s"), arg("y")), sp.set("life", v("s"), arg("life")),
      sp.set("vx", v("s"), mul(arg("speed"), sin(arg("dir")))), sp.set("vy", v("s"), mul(arg("speed"), cos(arg("dir")))),
      sp.set("col", v("s"), arg("col")), sp.set("kind", v("s"), arg("kind")), change("sparks", 1)]),
  ], { args: ["x", "y", "dir", "speed", "life", "col", "kind"], warp: true, x: 2300, y: 20 });
  define("burst %s %s %s %s %s %s %s", [
    set("bo", random(0, 30)), set("bq", 0),
    repeat(arg("n"), [call("spark %s %s %s %s %s %s %s", arg("x"), arg("y"), add(v("bo"), mul(v("bq"), div(360, arg("n")))), arg("speed"), arg("life"), arg("col"), arg("kind")), change("bq", 1)]),
  ], { args: ["x", "y", "n", "speed", "life", "col", "kind"], warp: true, x: 2300, y: 500 });

  define("move sparks", [
    set("j", 1),
    repeat(SP, [ifThen(eq(S("on"), 1), [
      sp.change("x", v("j"), S("vx")), sp.change("y", v("j"), S("vy")),
      // Gravity; willow sparks (kind 2) hang and drift.
      ifElse(eq(S("kind"), 2), [sp.change("vy", v("j"), -0.03), sp.set("vx", v("j"), mul(S("vx"), 0.985)), sp.set("vy", v("j"), mul(S("vy"), 0.985))],
        [sp.change("vy", v("j"), -0.06)]),
      sp.change("life", v("j"), -1),
      // A spark sets off every waiting firework it touches.
      ifThen(or(eq(v("phase"), "test"), eq(v("phase"), "go")), [
        set("i", 1), repeat(FW, [
          ifThen(and(and(eq(F("on"), 1), eq(F("st"), 0)), and(lt(abs(sub(F("x"), S("x"))), HIT), lt(abs(sub(F("y"), S("y"))), HIT))), [call("ignite %s", v("i"))]),
          change("i", 1)])]),
      ifThen(or(not(gt(S("life"), 0)), or(gt(abs(S("x")), 250), lt(S("y"), -185))), [
        // A crossette's star (kind 1) bursts again when it burns out.
        ifThen(and(eq(S("kind"), 1), not(gt(S("life"), 0))), [call("burst %s %s %s %s %s %s %s", S("x"), S("y"), 6, 3, 14, "blue", 0)]),
        sp.set("on", v("j"), 0), change("sparks", -1)]),
    ]), change("j", 1)]),
  ], { warp: true, x: 2300, y: 900 });

  define("roll score", [
    ifThen(not(eq(v("shown"), v("score"))), [
      ifElse(lt(v("shown"), 0), [set("shown", 0)], [change("shown", ceiling(div(sub(v("score"), v("shown")), 5)))]),
      ifThen(gt(v("shown"), v("score")), [set("shown", v("score"))]),
      ...write(d, { text: v("shown"), x: -175, y: 162, size: 40, group: G.score }), pulse(d, G.score, 8),
    ]),
  ], { warp: true, x: 2900, y: 20 });
  void until; void round; void floor; void length; void sqrt; void choose; void join; void min; void wait;
  return B;
}

// ---------------------------------------------------------------- sprites that draw the pools
function poolSprite(n: number, draw: (d: D) => any[]): Blocks {
  const B = new Blocks(P).local("isClone", "i");
  const d = dsl(B);
  B.script(d.whenFlag(), [d.hide(), d.set("isClone", 0), d.set("i", 1), d.repeat(n, [d.cloneMyself(), d.change("i", 1)])], 20, 20);
  B.script(d.whenCloned(), [d.set("isClone", 1)], 20, 160);
  B.script(d.whenReceive("tick"), [d.ifThen(d.eq(d.v("isClone"), 1), draw(d))], 20, 240);
  return B;
}
const at = (d: D, x: In, y: In) => d.goto(d.add(x, d.v("shakeX")), d.add(y, d.v("shakeY")));
const playing = (d: D) => d.not(d.or(d.eq(d.v("phase"), "title"), d.eq(d.v("phase"), "ready")));

const fireworks = () => poolSprite(FW, d => { const r = fwRec(d), i = d.v("i");
  return [d.ifElse(d.and(playing(d), d.and(d.eq(r.get("on", i), 1), d.lt(r.get("st", i), 2))), [
    d.costumeTo(r.get("kind", i)), d.point(r.get("dir", i)),
    // A shell about to burst shakes; one being dragged is a little bigger.
    d.ifElse(d.eq(r.get("st", i), 1), [at(d, d.add(r.get("x", i), d.random(-1, 1)), d.add(r.get("y", i), d.random(-1, 1)))], [at(d, r.get("x", i), r.get("y", i))]),
    d.ifElse(d.eq(d.v("drag"), i), [d.setSize(115)], [d.setSize(100)]), d.show()], [d.hide()])]; });
const sparks = () => poolSprite(SP, d => { const r = spRec(d), i = d.v("i");
  return [d.ifElse(d.eq(r.get("on", i), 1), [d.costumeTo(r.get("col", i)), d.setSize(d.add(40, d.mul(4, d.min(15, r.get("life", i))))),
    at(d, r.get("x", i), r.get("y", i)), d.show()], [d.hide()])]; });
// The tray: a slot and an icon per kind (dimmed when none are left, hidden if the level has none).
function trayScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "k", "icon");
  const d = dsl(B);
  const { v, add, sub, mul, eq, gt, set, change, ifThen, ifElse, repeat, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself,
    item, costume, costumeTo, setEffect, setSize, point, and } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0), set("k", 1),
    repeat(KINDS.length, [set("icon", 0), cloneMyself(), set("icon", 1), cloneMyself(), change("k", 1)])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), goto(item("slotX", v("k")), TRAY_Y),
    ifElse(eq(v("icon"), 1), [costumeTo(add(v("k"), 1)), setSize(70), point(0), d.changeX(-6)], [costume("slot")])], 20, 200);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    ifElse(and(playing(d), gt(item("lvMax", add(mul(sub(v("L"), 1), KINDS.length), v("k"))), 0)), [
      ifElse(gt(item("inv", v("k")), 0), [setEffect("GHOST", 0)], [setEffect("GHOST", 65)]), show()], [hide()])])], 20, 360);
  return B;
}
function buttonScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "b");
  const d = dsl(B);
  B.script(d.whenFlag(), [d.hide(), d.set("isClone", 0), d.set("b", 1), d.cloneMyself(), d.set("b", 2), d.cloneMyself()], 20, 20);
  B.script(d.whenCloned(), [d.set("isClone", 1), d.goto(d.item("buttonX", d.v("b")), BUTTON_Y), d.setSize(64)], 20, 160);
  B.script(d.whenReceive("buttons"), [d.ifThen(d.eq(d.v("isClone"), 1), [
    d.cond([
      [d.eq(d.v("phase"), "build"), [d.ifElse(d.eq(d.v("b"), 1), [d.costume("test")], [d.costume("go")]), d.show()]],
      [d.eq(d.v("phase"), "tested"), [d.ifElse(d.eq(d.v("b"), 1), [d.costume("reset")], [d.costume("go")]), d.show()]],
    ], [d.hide()])])], 20, 280);
  return B;
}
function fuseScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.hide()], 20, 20);
  B.script(d.whenReceive("tick"), [d.ifElse(playing(d), [d.goto(d.v("fuseX"), d.v("fuseY")),
    d.ifElse(d.eq(d.v("fuse"), 1), [d.costume("lit")], [d.costume("fuse")]), d.show()], [d.hide()])], 20, 100);
  return B;
}
function ringScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const r = fwRec(d);
  B.script(d.whenFlag(), [d.hide()], 20, 20);
  B.script(d.whenReceive("tick"), [d.ifElse(d.and(d.eq(d.v("phase"), "build"), d.gt(d.v("hover"), 0)), [
    d.goto(r.get("x", d.v("hover")), r.get("y", d.v("hover"))), d.turn(3), d.show()], [d.hide()])], 20, 100);
  return B;
}
// The sky lights up with big bursts: "flash" (0..100) is how bright, and fades every frame.
function flashScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, 0), d.hide()], 20, 20);
  B.script(d.whenReceive("tick"), [d.ifElse(d.gt(d.v("flash"), 1), [d.setEffect("GHOST", d.sub(100, d.v("flash"))), d.show()], [d.hide()])], 20, 100);
  return B;
}
const clickable = (B: Blocks) => { const d = dsl(B); B.script(d.whenClicked(), [d.broadcast("other click")], 300, 20); return B; };

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Tray", { blocks: clickable(trayScripts()), costumes: [...A.slot, ...A.firework], layer: 1, visible: false }),
    P.sprite("Fuse", { blocks: clickable(fuseScripts()), costumes: A.fuse, layer: 2, visible: false }),
    P.sprite("Ring", { blocks: clickable(ringScripts()), costumes: A.ring, layer: 3, visible: false }),
    P.sprite("Firework", { blocks: clickable(fireworks()), costumes: A.firework, layer: 4, visible: false }),
    P.sprite("Spark", { blocks: clickable(sparks()), costumes: A.spark, layer: 5, visible: false }),
    P.sprite("Button", { blocks: clickable(buttonScripts()), costumes: A.button, layer: 6, visible: false }),
    P.sprite("Glitter", { blocks: sparkScripts(P), costumes: sparkCostumes(P), layer: 7, visible: false }),
    P.sprite("Flash", { blocks: clickable(flashScripts()), costumes: A.flash, layer: 9, visible: false }),
    P.sprite("Text", { blocks: textScripts(P), costumes: textCostumes(P, "chain-spark-deluxe"), layer: 8, visible: false }),
  ],
  listValues: {
    ...kitLists(),
    ...Object.fromEntries((["on", "kind", "x", "y", "dir", "hx", "hy", "hdir", "st", "t", "a"]).map(f => [`fw.${f}`, Array(FW).fill(0)])),
    ...Object.fromEntries((["on", "x", "y", "vx", "vy", "life", "col", "kind"]).map(f => [`sp.${f}`, Array(SP).fill(0)])),
    inv: KINDS.map(() => 0), slotX: SLOT_X, buttonX: BUTTON_X, points: KINDS.map(k => POINTS[k]),
    lvSky: LEVELS.map(l => l[0]), lvFuseX: LEVELS.map(l => l[1]), lvFuseY: LEVELS.map(l => l[2]), lvTarget: LEVELS.map(l => l[3]),
    lvInv: LEVELS.flatMap(l => l[4]), lvMax: LEVELS.flatMap(l => l[4]), lvNew: NEW_KIND,
    lvStars: LEVELS.map(() => 0), starText: ["★", "★★", "★★★"],
  },
  shown: [],
});
writeFileSync(new URL("chain-spark-deluxe.sb3", import.meta.url), sb3);
console.log(`chain-spark-deluxe.sb3: ${sb3.length} bytes`);
