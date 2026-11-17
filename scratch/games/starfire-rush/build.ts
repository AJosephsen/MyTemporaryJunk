// Builds starfire-rush.sb3: a vertical shoot 'em up. The ship follows the mouse (or arrow keys / WASD) and fires on its
// own. Waves of enemies come down, harder and harder: drifters, wavers, divers, gunners, tanks, spinners, swarms; every
// fifth wave is a boss with three attack phases. Enemies drop power-ups: gun power (6 levels), repair, shield, bomb.
// Getting hit costs health and a gun level. Kills in quick succession build a chain multiplier (up to ×8).
//
// Engine: the Stage runs one update per frame (ship, guns, waves, enemies, bullets, collisions, power-ups, boss) on
// records that are fixed pools: pb (player bullets), en (enemies), eb (enemy bullets), pu (power-ups). Collisions are
// distance checks. Every pool has a sprite with one clone per row that only draws its row.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type In } from "../../lib/sb3.ts";
import { record } from "../../lib/records.ts";
import { textCostumes, textScripts, sparkCostumes, sparkScripts, kitLists, write, clear, pulse, emit } from "../math-kit/kit.ts";
import { art, ENEMIES, MAX_HP, MAX_GUN, SECTORS, STEEL } from "./art.ts";

const P = new Project();
type D = ReturnType<typeof dsl>;
export const PB = 32, EN = 20, EB = 56, PU = 8, OB = 4;
const STEEL_SPEED = 1.2, SHIP_HW = 15, SHIP_HH = 18, SHIP_STEP = 14;
// Energy each volley uses at each gun level (level 1 is free): doubling, so high levels burn out fast.
const GUN_COST = [0, 0.05, 1, 2, 4, 8], ENERGY_FULL = 100, ENERGY_AFTER_DROP = 60;   // the double shot hardly ever runs out
const SHIP_MIN_Y = -160, SHIP_MAX_Y = 110, FIRE_EVERY = 6, SHOT_SPEED = 13, BOSS_EVERY = 5;
const G = { score: 1, mult: 2, waveWord: 3, waveNum: 4, banner: 5, bannerNum: 6, title1: 7, title2: 8, click: 9,
  best: 10, bestWord: 11, pop: 12, chainWord: 13, chainNum: 14, praise: 15 };
// Gun patterns: for each level, shots as [x offset, angle from straight up].
const GUNS: [number, number][][] = [
  [[0, 0]],
  [[-7, 0], [7, 0]],
  [[0, 0], [-8, -8], [8, 8]],
  [[-6, 0], [6, 0], [-10, -10], [10, 10]],
  [[0, 0], [-8, -6], [8, 6], [-12, -16], [12, 16]],
  [[0, 0], [-6, -5], [6, 5], [-10, -12], [10, 12], [-14, -22], [14, 22]],
];
const pbRec = (d: D) => record(d, "pb", ["on", "x", "y", "vx", "vy"] as const);
const enRec = (d: D) => record(d, "en", ["on", "kind", "x", "y", "bx", "sy", "vx", "vy", "hp", "t", "fire", "hit", "st"] as const);
const ebRec = (d: D) => record(d, "eb", ["on", "x", "y", "vx", "vy", "k", "dir"] as const);
const puRec = (d: D) => record(d, "pu", ["on", "x", "y", "kind", "t"] as const);
// Steel: obstacles that cannot be shot; kind is the costume, hw/hh half its width and height.
const obRec = (d: D) => record(d, "ob", ["on", "x", "y", "kind", "hw", "hh"] as const);
const K = Object.fromEntries(ENEMIES.map((e, i) => [e.name, i + 1])) as Record<string, number>;

// ---------------------------------------------------------------- Stage: the game
function stageScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, add, sub, mul, div, eq, lt, gt, or, and, not, join, set, change, ifThen, ifElse, repeat, until, whenFlag,
    whenReceive, forever, broadcast, wait, random, replace, define, call, ceiling, floor, round, mod, abs, sin, cos, atan,
    switchBackdrop, arg, cond, choose, max, min, clamp, ret, compute, fn, mouseX, mouseY, key, item, length } = d;
  const pb = pbRec(d), en = enRec(d), eb = ebRec(d), pu = puRec(d), ob = obRec(d);
  const E = (f: Parameters<typeof en.get>[0]) => en.get(f, v("j"));

  B.script(whenFlag(), [
    set("phase", "title"), set("shake", 0), set("frame", 0), set("hideAbove", 400), set("score", 0), set("shown", 0),
    set("tap", 0), set("px", 0), set("py", -120), set("hp", MAX_HP), set("gun", 1), set("energy", 0), set("inv", 0), set("shieldT", 0),
    set("bossOn", 0), set("useMouse", 1), set("lastMx", 0), set("lastMy", 0), set("sector", 1), set("chain", 0), set("mult", 1),
    call("clear pools"), switchBackdrop(SECTORS[0]),
    call("title screen"),
    forever([
      change("frame", 1),
      set("shake", mul(v("shake"), 0.86)), ifThen(lt(v("shake"), 0.4), [set("shake", 0)]),
      set("shakeX", random(mul(v("shake"), -1), v("shake"))), set("shakeY", random(mul(v("shake"), -1), v("shake"))),
      set("press", v("tap")), set("tap", 0),
      set("scroll", 0.5), ifThen(eq(v("phase"), "play"), [set("scroll", 1)]),
      cond([
        [eq(v("phase"), "play"), [call("play")]],
        [or(eq(v("phase"), "title"), eq(v("phase"), "ready")), [
          replace("groupColor", G.title1, mul(v("frame"), 3)), replace("groupColor", G.title2, mul(v("frame"), 3)),
          ifThen(eq(mod(v("frame"), 20), 0), [pulse(d, G.click, 18)]),
          ifThen(eq(v("press"), 1), [call("new game")]),
        ]],
        [eq(v("phase"), "over"), [call("move bullets"), call("move enemies")]],
      ]),
      call("roll score"),
      broadcast("tick"),
    ]),
  ], 20, 20);
  B.script(d.whenStageClicked(), [set("tap", 1)], 20, 900);
  B.script(whenReceive("text click"), [set("tap", 1)], 20, 960);
  B.script(whenReceive("other click"), [set("tap", 1)], 20, 1020);
  B.script(d.whenKey("space"), [set("tap", 1)], 20, 1080);

  define("clear pools", [
    ...([[pb, PB], [en, EN], [eb, EB], [pu, PU], [ob, OB]] as const).flatMap(([r, n]) =>
      [set("i", 1), repeat(n, [(r as any).set("on", v("i"), 0), change("i", 1)])]),
    set("bossOn", 0),
  ], { warp: true, x: 560, y: 1500 });

  define("title screen", [
    ...write(d, { text: "word-sf1", x: 0, y: 70, size: 120, group: G.title1 }),
    ...write(d, { text: "word-sf2", x: 0, y: 10, size: 150, group: G.title2 }),
    ...write(d, { text: "word-clickplay", x: 0, y: -60, size: 52, group: G.click }),
    ifThen(gt(v("best"), 0), [
      ...write(d, { text: "word-best", x: -40, y: -110, size: 34, group: G.bestWord }),
      ...write(d, { text: v("best"), x: 50, y: -110, size: 40, group: G.best }),
    ]),
  ], { warp: true, x: 560, y: 20 });

  define("new game", [
    ...[G.title1, G.title2, G.click, G.best, G.bestWord, G.banner, G.bannerNum, G.mult, G.pop, G.praise, G.chainWord, G.chainNum]
      .flatMap(g => clear(d, g)),
    call("clear pools"),
    set("score", 0), set("shown", -1), set("hp", MAX_HP), set("gun", 1), set("energy", 0), set("inv", 60), set("shieldT", 0),
    set("px", 0), set("py", -120), set("chain", 0), set("chainT", 0), set("mult", 1), set("wave", 0), set("bosses", 0),
    set("sector", 1), switchBackdrop(SECTORS[0]),
    set("phase", "play"),
    call("next wave"),
  ], { warp: true, x: 560, y: 360 });

  // ---------------------------------------------------------------- waves
  define("next wave", [
    change("wave", 1),
    ...write(d, { text: "word-wave", x: 150, y: 162, size: 28, group: G.waveWord }),
    ...write(d, { text: v("wave"), x: 205, y: 162, size: 34, group: G.waveNum }),
    ifElse(eq(mod(v("wave"), BOSS_EVERY), 0), [
      // A boss: a warning first.
      set("wstate", "warning"), set("wT", 110), set("groupsLeft", 0),
      ...write(d, { text: "word-warning", x: 0, y: 40, size: 120, group: G.banner }), pulse(d, G.banner, 50),
    ], [
      set("wstate", "fight"), set("groupsLeft", add(4, v("wave"))), set("spawnT", 70),
      // Once a wave (from wave 2), at a random moment, a cluster of power-ups: a super shot for a while.
      set("steelT", random(120, 300)),
      set("clusterAt", -1), ifThen(gt(v("wave"), 1), [set("clusterAt", random(1, sub(v("groupsLeft"), 1)))]),
      ...write(d, { text: "word-wave", x: -40, y: 40, size: 100, group: G.banner }),
      ...write(d, { text: v("wave"), x: 90, y: 40, size: 120, group: G.bannerNum }),
      pulse(d, G.banner, 40), pulse(d, G.bannerNum, 40), set("bannerT", 60),
    ]),
  ], { warp: true, x: 560, y: 760 });

  // Kinds unlocked by the wave: 1 drifter; 2 +waver; 3 +diver; 4 +gunner; 6 +tank; 7 +spinner; 8 +swarm.
  define("unlocked", [
    choose("ul", [[lt(v("wave"), 5), v("wave")]], sub(v("wave"), 1)),
    ...ret("unlocked", min(7, v("ul"))),
  ], { warp: true, x: 1100, y: 20 });

  define("spawn group", [
    ...compute("u", [fn("unlocked")]),
    // Newer kinds a little more often.
    set("k", random(1, v("u"))), ifThen(eq(random(1, 3), 1), [set("k", v("u"))]),
    set("lvl", min(12, v("wave"))),
    cond([
      [eq(v("k"), K.drifter), [set("i", 0), repeat(5, [call("spawn %s %s %s %s", K.drifter, add(-160, mul(80, v("i"))), add(200, mul(18, v("i"))), 0), change("i", 1)])]],
      [eq(v("k"), K.waver), [set("bx0", random(-150, 150)), set("i", 0), repeat(4, [call("spawn %s %s %s %s", K.waver, v("bx0"), add(200, mul(36, v("i"))), mul(v("i"), 40)), change("i", 1)])]],
      [eq(v("k"), K.diver), [set("i", -1), repeat(3, [call("spawn %s %s %s %s", K.diver, mul(120, v("i")), add(200, mul(20, abs(v("i")))), 0), change("i", 1)])]],
      [eq(v("k"), K.gunner), [call("spawn %s %s %s %s", K.gunner, -110, 210, 0), call("spawn %s %s %s %s", K.gunner, 110, 230, 0)]],
      [eq(v("k"), K.tank), [call("spawn %s %s %s %s", K.tank, random(-120, 120), 220, 0)]],
      [eq(v("k"), K.spinner), [call("spawn %s %s %s %s", K.spinner, random(-100, 100), 220, 0)]],
    ], [set("i", 0), repeat(8, [call("spawn %s %s %s %s", K.swarm, random(-200, 200), add(200, mul(22, v("i"))), 0), change("i", 1)])]),
    change("groupsLeft", -1),
    ifThen(eq(v("groupsLeft"), v("clusterAt")), [call("power cluster %s", random(-170, 170))]),
    set("spawnT", max(45, sub(150, mul(8, v("wave"))))),
  ], { warp: true, x: 1100, y: 200 });

  define("spawn %s %s %s %s", [
    set("s", en.find("on", 0)),
    ifThen(gt(v("s"), 0), [
      en.set("on", v("s"), 1), en.set("kind", v("s"), arg("kind")), en.set("x", v("s"), arg("x")), en.set("y", v("s"), arg("y")),
      en.set("bx", v("s"), arg("x")), en.set("t", v("s"), arg("t0")), en.set("hit", v("s"), 0), en.set("st", v("s"), 0),
      en.set("hp", v("s"), add(item("enHp", arg("kind")), floor(div(v("wave"), 6)))),
      en.set("fire", v("s"), random(30, 90)), en.set("vx", v("s"), mul(item("signs", random(1, 2)), 1.2)),
      en.set("vy", v("s"), mul(-1, add(1.4, mul(0.08, min(12, v("wave")))))),
      en.set("sy", v("s"), random(60, 120)),
    ]),
  ], { args: ["kind", "x", "y", "t0"], warp: true, x: 1100, y: 1100 });

  // ---------------------------------------------------------------- one frame of play
  define("play", [
    ifThen(gt(v("bannerT"), 0), [change("bannerT", -1), ifThen(eq(v("bannerT"), 0), [...clear(d, G.banner), ...clear(d, G.bannerNum)])]),
    call("move ship"),
    call("fire guns"),
    cond([
      [eq(v("wstate"), "fight"), [
        change("spawnT", -1),
        // Steel from wave 3: rare at first, more often later; from wave 7 sometimes two with a gap between.
        ifThen(gt(v("wave"), 2), [change("steelT", -1), ifThen(not(gt(v("steelT"), 0)), [
          set("steelT", add(max(150, sub(560, mul(35, v("wave")))), random(0, 120))),
          ifElse(and(gt(v("wave"), 6), lt(random(1, 100), 36)), [
            call("spawn steel %s %s", random(-170, -90), random(1, 2)), call("spawn steel %s %s", random(90, 170), random(1, 2))],
            [call("spawn steel %s %s", random(-150, 150), random(1, 4))])])]),
        ifThen(and(not(gt(v("spawnT"), 0)), gt(v("groupsLeft"), 0)), [call("spawn group")]),
        ifThen(and(eq(v("groupsLeft"), 0), eq(en.find("on", 1), 0)), [call("wave clear")]),
      ]],
      [eq(v("wstate"), "warning"), [
        change("wT", -1), ifThen(eq(mod(v("wT"), 20), 0), [pulse(d, G.banner, 40), set("flashKind", "red"), broadcast("flash")]),
        ifThen(not(gt(v("wT"), 0)), [...clear(d, G.banner), call("boss enter")]),
      ]],
      [eq(v("wstate"), "boss"), [call("boss")]],
      [eq(v("wstate"), "bossdown"), [call("boss down")]],
      [eq(v("wstate"), "clear"), [change("wT", -1), ifThen(not(gt(v("wT"), 0)), [...clear(d, G.banner), ...clear(d, G.bannerNum), call("next wave")])]],
    ]),
    call("move enemies"),
    call("move bullets"),
    call("move powerups"),
    call("move steel"),
    // Timers.
    ifThen(gt(v("inv"), 0), [change("inv", -1)]),
    ifThen(gt(v("shieldT"), 0), [change("shieldT", -1)]),
    ifThen(gt(v("chainT"), 0), [change("chainT", -1), ifThen(eq(v("chainT"), 0), [set("chain", 0), set("mult", 1),
      ...clear(d, G.chainWord), ...clear(d, G.chainNum), ...clear(d, G.mult)])]),
  ], { warp: true, x: 1700, y: 20 });

  define("wave clear", [
    set("bonus", mul(1000, v("wave"))), change("score", v("bonus")),
    ...write(d, { text: "word-clear", x: 0, y: 50, size: 110, group: G.banner }), pulse(d, G.banner, 50),
    ...write(d, { text: join("+", v("bonus")), x: 0, y: -10, size: 70, group: G.bannerNum }), pulse(d, G.bannerNum, 50),
    repeat(3, [...emit(d, "confetti", random(-200, 200), 180, 8)]),
    set("wstate", "clear"), set("wT", 80), set("bannerT", 0),
  ], { warp: true, x: 1700, y: 700 });

  // ---------------------------------------------------------------- the ship
  define("move ship", [
    // The mouse steers when it moves; keys take over when pressed.
    ifThen(or(not(eq(mouseX(), v("lastMx"))), not(eq(mouseY(), v("lastMy")))), [set("useMouse", 1)]),
    set("lastMx", mouseX()), set("lastMy", mouseY()),
    set("kx", 0), set("ky", 0),
    ifThen(or(key("left arrow"), key("a")), [change("kx", -1)]), ifThen(or(key("right arrow"), key("d")), [change("kx", 1)]),
    ifThen(or(key("up arrow"), key("w")), [change("ky", 1)]), ifThen(or(key("down arrow"), key("s")), [change("ky", -1)]),
    ifThen(or(not(eq(v("kx"), 0)), not(eq(v("ky"), 0))), [set("useMouse", 0)]),
    ifElse(eq(v("useMouse"), 1), [
      // Eased towards the mouse, but never more than SHIP_STEP a frame (so it cannot jump over steel).
      change("px", clamp(mul(sub(mouseX(), v("px")), 0.35), -SHIP_STEP, SHIP_STEP)),
      change("py", clamp(mul(sub(mouseY(), v("py")), 0.35), -SHIP_STEP, SHIP_STEP))], [
      change("px", mul(v("kx"), 6)), change("py", mul(v("ky"), 6))]),
    set("px", clamp(v("px"), -225, 225)), set("py", clamp(v("py"), SHIP_MIN_Y, SHIP_MAX_Y)),
    call("steel push"),
  ], { warp: true, x: 2300, y: 20 });

  define("fire guns", [
    change("fireT", -1),
    ifThen(not(gt(v("fireT"), 0)), [
      set("fireT", FIRE_EVERY),
      set("g", item("gunStart", v("gun"))),
      repeat(item("gunCount", v("gun")), [
        set("s", pb.find("on", 0)),
        ifThen(gt(v("s"), 0), [
          pb.set("on", v("s"), 1), pb.set("x", v("s"), add(v("px"), item("gunDx", v("g")))), pb.set("y", v("s"), add(v("py"), 22)),
          pb.set("vx", v("s"), mul(SHOT_SPEED, sin(item("gunAng", v("g"))))), pb.set("vy", v("s"), mul(SHOT_SPEED, cos(item("gunAng", v("g"))))),
        ]),
        change("g", 1)]),
      // Above level 1 every volley uses energy; when it runs out the gun drops a level.
      ifThen(gt(v("gun"), 1), [
        change("energy", mul(-1, item("gunCost", v("gun")))),
        ifThen(not(gt(v("energy"), 0)), [
          change("gun", -1), set("energy", ENERGY_AFTER_DROP), ifThen(eq(v("gun"), 1), [set("energy", 0)]),
          ...emit(d, "spark", v("px"), v("py"), 6)]),
      ]),
    ]),
  ], { warp: true, x: 2300, y: 600 });

  // ---------------------------------------------------------------- enemies
  define("move enemies", [
    set("j", 1),
    repeat(EN, [
      ifThen(eq(E("on"), 1), [
        en.change("t", v("j"), 1), ifThen(gt(E("hit"), 0), [en.change("hit", v("j"), -1)]),
        set("ek", E("kind")),
        cond([
          [eq(v("ek"), K.drifter), [en.change("y", v("j"), E("vy"))]],
          [eq(v("ek"), K.waver), [en.change("y", v("j"), mul(0.9, E("vy"))), en.set("x", v("j"), add(E("bx"), mul(60, sin(mul(E("t"), 4)))))]],
          [eq(v("ek"), K.diver), [cond([
            [eq(E("st"), 0), [en.change("y", v("j"), -2.6), ifThen(lt(E("y"), E("sy")), [en.set("st", v("j"), 1), en.set("fire", v("j"), 28)])]],
            [eq(E("st"), 1), [en.change("fire", v("j"), -1), en.set("x", v("j"), add(E("x"), mul(2, sin(mul(E("t"), 40))))),
              ifThen(not(gt(E("fire"), 0)), [
                // Dive at the ship.
                ...compute("a", [fn("aim %s %s", E("x"), E("y"))]),
                en.set("vx", v("j"), mul(6.5, sin(v("a")))), en.set("vy", v("j"), mul(6.5, cos(v("a")))), en.set("st", v("j"), 2)])]],
          ], [en.change("x", v("j"), E("vx")), en.change("y", v("j"), E("vy"))])]],
          [eq(v("ek"), K.gunner), [cond([
            [eq(E("st"), 0), [en.change("y", v("j"), -2.2), ifThen(lt(E("y"), E("sy")), [en.set("st", v("j"), 1)])]],
            [eq(E("st"), 1), [
              en.change("x", v("j"), E("vx")), ifThen(gt(abs(E("x")), 200), [en.set("vx", v("j"), mul(-1, E("vx")))]),
              en.change("fire", v("j"), -1),
              ifThen(not(gt(E("fire"), 0)), [en.set("fire", v("j"), max(35, sub(90, mul(4, v("wave"))))),
                ...compute("a", [fn("aim %s %s", E("x"), E("y"))]), call("shot %s %s %s %s %s", E("x"), sub(E("y"), 18), v("a"), add(3.2, mul(0.1, min(15, v("wave")))), 2)]),
              ifThen(gt(E("t"), 600), [en.set("st", v("j"), 2)])]],
          ], [en.change("y", v("j"), -4)])]],
          [eq(v("ek"), K.tank), [
            en.change("y", v("j"), -0.55),
            en.change("fire", v("j"), -1),
            ifThen(not(gt(E("fire"), 0)), [en.set("fire", v("j"), max(45, sub(80, mul(2, v("wave"))))),
              ...compute("a", [fn("aim %s %s", E("x"), E("y"))]),
              set("q", -1), repeat(3, [call("shot %s %s %s %s %s", E("x"), sub(E("y"), 28), add(v("a"), mul(16, v("q"))), 3, 1), change("q", 1)])]),
          ]],
          [eq(v("ek"), K.spinner), [cond([
            [eq(E("st"), 0), [en.change("y", v("j"), -2), ifThen(lt(E("y"), E("sy")), [en.set("st", v("j"), 1), en.set("t", v("j"), 0)])]],
            [eq(E("st"), 1), [
              en.set("x", v("j"), add(E("bx"), mul(80, sin(mul(E("t"), 2))))), en.set("y", v("j"), add(E("sy"), mul(25, sin(mul(E("t"), 3))))),
              en.change("fire", v("j"), -1),
              ifThen(not(gt(E("fire"), 0)), [en.set("fire", v("j"), max(55, sub(100, mul(3, v("wave"))))),
                set("q", 0), repeat(8, [call("shot %s %s %s %s %s", E("x"), E("y"), add(mul(45, v("q")), mul(E("t"), 7)), 2.6, 1), change("q", 1)])]),
              ifThen(gt(E("t"), 700), [en.set("st", v("j"), 2)])]],
          ], [en.change("y", v("j"), -3)])]],
        ], [
          // Swarm: fast, and drawn towards the ship.
          en.change("y", v("j"), -3.8), en.change("x", v("j"), mul(0.035, sub(v("px"), E("x")))),
        ]),
        // Gone off the screen.
        ifThen(or(lt(E("y"), -215), gt(abs(E("x")), 290)), [en.set("on", v("j"), 0)]),
        // Ramming the ship.
        ifThen(and(eq(E("on"), 1), and(lt(abs(sub(E("x"), v("px"))), add(item("enR", E("kind")), 10)), lt(abs(sub(E("y"), v("py"))), add(item("enR", E("kind")), 12)))), [
          ifElse(eq(E("kind"), K.tank), [call("ship hit %s", 2)], [call("ship hit %s", 1), call("kill %s %s", v("j"), 0)])]),
      ]),
      change("j", 1),
    ]),
  ], { warp: true, x: 2900, y: 20 });

  // The direction from (x, y) to the ship, Scratch style (0 up, clockwise).
  define("aim %s %s", [
    set("adx", sub(v("px"), arg("x"))), set("ady", sub(v("py"), arg("y"))),
    set("aa", atan(div(v("adx"), v("ady")))), ifThen(lt(v("ady"), 0), [change("aa", 180)]),
    ...ret("aim %s %s", v("aa")),
  ], { args: ["x", "y"], warp: true, x: 2900, y: 2300 });

  define("shot %s %s %s %s %s", [
    set("s", eb.find("on", 0)),
    ifThen(gt(v("s"), 0), [
      eb.set("on", v("s"), 1), eb.set("x", v("s"), arg("x")), eb.set("y", v("s"), arg("y")), eb.set("k", v("s"), arg("k")),
      eb.set("dir", v("s"), arg("dir")),
      eb.set("vx", v("s"), mul(arg("speed"), sin(arg("dir")))), eb.set("vy", v("s"), mul(arg("speed"), cos(arg("dir")))),
    ]),
  ], { args: ["x", "y", "dir", "speed", "k"], warp: true, x: 2900, y: 2600 });

  define("kill %s %s", [
    set("kj", arg("j")), set("kx", en.get("x", v("kj"))), set("ky", en.get("y", v("kj"))), set("kk", en.get("kind", v("kj"))),
    en.set("on", v("kj"), 0),
    ...emit(d, "debris", v("kx"), v("ky"), 5), ...emit(d, "ember", v("kx"), v("ky"), 4),
    ifThen(gt(item("enR", v("kk")), 18), [...emit(d, "ring", v("kx"), v("ky"), 1), ...emit(d, "smoke", v("kx"), v("ky"), 3), set("shake", max(v("shake"), 7))]),
    ifThen(eq(arg("scored"), 1), [
      // The chain: kills close together multiply the score.
      change("chain", 1), set("chainT", 60), set("mult", min(8, add(1, floor(div(v("chain"), 6))))),
      set("pts", mul(item("enScore", v("kk")), v("mult"))), change("score", v("pts")),
      ifThen(not(lt(v("pts"), 500)), [...write(d, { text: v("pts"), x: v("kx"), y: v("ky"), size: 34, group: G.pop, mode: "float" })]),
      ifThen(eq(mod(v("chain"), 6), 0), [
        ...write(d, { text: "word-chain", x: -30, y: 128, size: 30, group: G.chainWord }),
        ...write(d, { text: v("chain"), x: 40, y: 128, size: 36, group: G.chainNum }), pulse(d, G.chainNum, 40),
        ...write(d, { text: join("×", v("mult")), x: -75, y: 162, size: 32, group: G.mult }), pulse(d, G.mult, 40)]),
      call("maybe drop %s %s %s", v("kx"), v("ky"), v("kk")),
    ]),
  ], { args: ["j", "scored"], warp: true, x: 3500, y: 20 });

  // ---------------------------------------------------------------- bullets and collisions
  define("move bullets", [
    // The ship's shots: move, then hit the first enemy (or the boss) they touch.
    set("i", 1),
    repeat(PB, [
      ifThen(eq(pb.get("on", v("i")), 1), [
        pb.change("x", v("i"), pb.get("vx", v("i"))), pb.change("y", v("i"), pb.get("vy", v("i"))),
        ifThen(or(gt(pb.get("y", v("i")), 190), gt(abs(pb.get("x", v("i"))), 250)), [pb.set("on", v("i"), 0)]),
        ...compute("inSteel", [fn("in steel %s %s", pb.get("x", v("i")), pb.get("y", v("i")))]),
        ifThen(eq(v("inSteel"), 1), [pb.set("on", v("i"), 0), ifThen(eq(mod(v("i"), 3), 0), [...emit(d, "spark", pb.get("x", v("i")), pb.get("y", v("i")), 1)])]),
        set("j", 1),
        repeat(EN, [
          ifThen(and(eq(pb.get("on", v("i")), 1), eq(E("on"), 1)), [
            ifThen(and(lt(abs(sub(pb.get("x", v("i")), E("x"))), add(item("enR", E("kind")), 4)),
              lt(abs(sub(pb.get("y", v("i")), E("y"))), add(item("enR", E("kind")), 10))), [
              pb.set("on", v("i"), 0), en.change("hp", v("j"), -1), en.set("hit", v("j"), 3),
              ifThen(not(gt(E("hp"), 0)), [call("kill %s %s", v("j"), 1)]),
            ]),
          ]),
          change("j", 1)]),
        ifThen(and(eq(pb.get("on", v("i")), 1), eq(v("bossOn"), 1)), [
          ifThen(and(lt(abs(sub(pb.get("x", v("i")), v("bossX"))), 95), lt(abs(sub(pb.get("y", v("i")), v("bossY"))), 45)), [
            pb.set("on", v("i"), 0), change("bossHp", -1), set("bossHit", 3),
            ifThen(eq(mod(v("bossHp"), 4), 0), [...emit(d, "spark", pb.get("x", v("i")), pb.get("y", v("i")), 2)]),
          ]),
        ]),
      ]),
      change("i", 1)]),
    // Enemy shots: move; the shield wipes them out; otherwise they hit the ship's small core.
    set("i", 1),
    repeat(EB, [
      ifThen(eq(eb.get("on", v("i")), 1), [
        eb.change("x", v("i"), eb.get("vx", v("i"))), eb.change("y", v("i"), eb.get("vy", v("i"))),
        ifThen(or(gt(abs(eb.get("y", v("i"))), 200), gt(abs(eb.get("x", v("i"))), 250)), [eb.set("on", v("i"), 0)]),
        ...compute("inSteel", [fn("in steel %s %s", eb.get("x", v("i")), eb.get("y", v("i")))]),
        ifThen(eq(v("inSteel"), 1), [eb.set("on", v("i"), 0)]),
        ifThen(and(eq(eb.get("on", v("i")), 1), eq(v("phase"), "play")), [
          set("bdx", abs(sub(eb.get("x", v("i")), v("px")))), set("bdy", abs(sub(eb.get("y", v("i")), v("py")))),
          ifElse(gt(v("shieldT"), 0), [
            ifThen(and(lt(v("bdx"), 36), lt(v("bdy"), 36)), [eb.set("on", v("i"), 0), ...emit(d, "spark", eb.get("x", v("i")), eb.get("y", v("i")), 2)])], [
            ifThen(and(lt(v("bdx"), 7), lt(v("bdy"), 9)), [eb.set("on", v("i"), 0), call("ship hit %s", 1)])]),
        ]),
      ]),
      change("i", 1)]),
  ], { warp: true, x: 3500, y: 900 });

  define("ship hit %s", [
    ifThen(and(eq(v("inv"), 0), eq(v("shieldT"), 0)), [
      change("hp", mul(-1, arg("n"))), set("inv", 75), set("gun", max(1, sub(v("gun"), 1))),
      set("chain", 0), set("chainT", 0), set("mult", 1), ...clear(d, G.chainWord), ...clear(d, G.chainNum), ...clear(d, G.mult),
      set("shake", 12), set("flashKind", "red"), broadcast("flash"),
      ...emit(d, "debris", v("px"), v("py"), 6), ...emit(d, "spark", v("px"), v("py"), 8),
      ifThen(not(gt(v("hp"), 0)), [set("hp", 0), set("phase", "over"), broadcast("game over")]),
    ]),
  ], { args: ["n"], warp: true, x: 3500, y: 2000 });

  // ---------------------------------------------------------------- power-ups
  define("maybe drop %s %s %s", [
    set("chance", 9), ifThen(eq(arg("kind"), K.tank), [set("chance", 100)]), ifThen(eq(arg("kind"), K.spinner), [set("chance", 50)]),
    ifThen(not(gt(random(1, 100), v("chance"))), [
      // Mostly power while the gun is weak; repair when hurt.
      set("r", random(1, 100)),
      choose("dk", [[lt(v("r"), add(45, mul(10, max(0, sub(3, v("gun")))))), 1], [lt(v("r"), add(65, mul(5, sub(MAX_HP, v("hp"))))), 2], [lt(v("r"), 88), 3]], 4),
      call("drop %s %s %s", arg("x"), arg("y"), v("dk")),
    ]),
  ], { args: ["x", "y", "kind"], warp: true, x: 4100, y: 20 });
  define("drop %s %s %s", [
    set("s", pu.find("on", 0)),
    ifThen(gt(v("s"), 0), [pu.set("on", v("s"), 1), pu.set("x", v("s"), arg("x")), pu.set("y", v("s"), arg("y")), pu.set("kind", v("s"), arg("k")), pu.set("t", v("s"), 0)]),
  ], { args: ["x", "y", "k"], warp: true, x: 4100, y: 500 });

  // ---------------------------------------------------------------- steel
  define("spawn steel %s %s", [
    set("s", ob.find("on", 0)),
    ifThen(gt(v("s"), 0), [
      ob.set("on", v("s"), 1), ob.set("kind", v("s"), arg("k")), ob.set("x", v("s"), arg("x")),
      ob.set("hw", v("s"), item("steelHw", arg("k"))), ob.set("hh", v("s"), item("steelHh", arg("k"))),
      ob.set("y", v("s"), add(190, item("steelHh", arg("k")))),
    ]),
  ], { args: ["x", "k"], warp: true, x: 4700, y: 1900 });
  define("move steel", [
    set("o", 1), repeat(OB, [ifThen(eq(ob.get("on", v("o")), 1), [
      ob.change("y", v("o"), -STEEL_SPEED), ifThen(lt(ob.get("y", v("o")), -260), [ob.set("on", v("o"), 0)])]), change("o", 1)]),
  ], { warp: true, x: 4700, y: 2200 });
  // 1 if the point (x, y) is inside a steel obstacle, else 0.
  define("in steel %s %s", [
    set("hit", 0), set("o", 1),
    repeat(OB, [ifThen(and(eq(ob.get("on", v("o")), 1), and(lt(abs(sub(arg("x"), ob.get("x", v("o")))), ob.get("hw", v("o"))),
      lt(abs(sub(arg("y"), ob.get("y", v("o")))), ob.get("hh", v("o"))))), [set("hit", 1)]), change("o", 1)]),
    ...ret("in steel %s %s", v("hit")),
  ], { args: ["x", "y"], warp: true, x: 4700, y: 2400 });
  // The ship cannot fly into steel: it is pushed out the shortest way. Pinned against the bottom, it is crushed.
  define("steel push", [
    set("o", 1),
    repeat(OB, [
      ifThen(eq(ob.get("on", v("o")), 1), [
        set("odx", sub(v("px"), ob.get("x", v("o")))), set("ody", sub(v("py"), ob.get("y", v("o")))),
        set("penX", sub(add(ob.get("hw", v("o")), SHIP_HW), abs(v("odx")))), set("penY", sub(add(ob.get("hh", v("o")), SHIP_HH), abs(v("ody")))),
        ifThen(and(gt(v("penX"), 0), gt(v("penY"), 0)), [
          ifElse(lt(v("penX"), v("penY")),
            [ifElse(lt(v("odx"), 0), [change("px", mul(-1, v("penX")))], [change("px", v("penX"))])],
            [ifElse(lt(v("ody"), 0), [change("py", mul(-1, v("penY")))], [change("py", v("penY"))])]),
          // Pushed off the screen: crushed. A hit, and out to the side.
          ifThen(or(lt(v("py"), SHIP_MIN_Y), gt(abs(v("px")), 225)), [
            call("ship hit %s", 1), set("py", SHIP_MIN_Y),
            ifElse(lt(ob.get("x", v("o")), 0), [set("px", add(ob.get("x", v("o")), add(ob.get("hw", v("o")), SHIP_HW + 4)))],
              [set("px", sub(ob.get("x", v("o")), add(ob.get("hw", v("o")), SHIP_HW + 4)))]),
            set("px", clamp(v("px"), -225, 225))]),
        ]),
      ]),
      change("o", 1)]),
  ], { warp: true, x: 4700, y: 2700 });

  // Three power-ups close together, falling from the top.
  define("power cluster %s", [
    call("drop %s %s %s", sub(arg("x"), 24), 200, 1), call("drop %s %s %s", add(arg("x"), 24), 200, 1),
    call("drop %s %s %s", arg("x"), 232, 1),
  ], { args: ["x"], warp: true, x: 4100, y: 650 });

  define("move powerups", [
    set("i", 1),
    repeat(PU, [
      ifThen(eq(pu.get("on", v("i")), 1), [
        pu.change("t", v("i"), 1), pu.change("y", v("i"), -1.3), pu.change("x", v("i"), mul(0.8, sin(mul(pu.get("t", v("i")), 5)))),
        ifThen(lt(pu.get("y", v("i")), -200), [pu.set("on", v("i"), 0)]),
        ifThen(and(lt(abs(sub(pu.get("x", v("i")), v("px"))), 26), lt(abs(sub(pu.get("y", v("i")), v("py"))), 28)), [
          pu.set("on", v("i"), 0), call("collect %s", pu.get("kind", v("i")))]),
      ]),
      change("i", 1)]),
  ], { warp: true, x: 4100, y: 800 });

  define("collect %s", [
    set("ck", arg("k")),
    ...emit(d, "ring", v("px"), v("py"), 1), ...emit(d, "spark", v("px"), v("py"), 10),
    cond([
      [eq(v("ck"), 1), [set("energy", ENERGY_FULL), ifElse(lt(v("gun"), MAX_GUN), [change("gun", 1),
        ifElse(eq(v("gun"), MAX_GUN), [...write(d, { text: "word-maxpower", x: v("px"), y: add(v("py"), 50), size: 56, group: G.praise, mode: "float" })],
          [...write(d, { text: "word-powerup", x: v("px"), y: add(v("py"), 50), size: 56, group: G.praise, mode: "float" })])],
        [change("score", 2000), ...write(d, { text: "+2000", x: v("px"), y: add(v("py"), 50), size: 50, group: G.praise, mode: "float" })])]],
      [eq(v("ck"), 2), [set("hp", min(MAX_HP, add(v("hp"), 2))), ...write(d, { text: "word-repair", x: v("px"), y: add(v("py"), 50), size: 56, group: G.praise, mode: "float" })]],
      [eq(v("ck"), 3), [set("shieldT", 300), ...write(d, { text: "word-shieldon", x: v("px"), y: add(v("py"), 50), size: 56, group: G.praise, mode: "float" })]],
    ], [call("bomb")]),
  ], { args: ["k"], warp: true, x: 4100, y: 1300 });

  define("bomb", [
    ...write(d, { text: "word-bomb", x: 0, y: 40, size: 120, group: G.praise, mode: "float" }),
    set("shake", 16), set("flashKind", "white"), broadcast("flash"),
    set("i", 1), repeat(EB, [ifThen(eq(eb.get("on", v("i")), 1), [eb.set("on", v("i"), 0),
      ifThen(eq(mod(v("i"), 4), 0), [...emit(d, "spark", eb.get("x", v("i")), eb.get("y", v("i")), 2)])]), change("i", 1)]),
    set("j", 1), repeat(EN, [ifThen(eq(E("on"), 1), [en.change("hp", v("j"), -14), ifThen(not(gt(E("hp"), 0)), [call("kill %s %s", v("j"), 1)])]), change("j", 1)]),
    ifThen(eq(v("bossOn"), 1), [change("bossHp", -40)]),
  ], { warp: true, x: 4100, y: 1900 });

  // ---------------------------------------------------------------- the boss
  define("boss enter", [
    change("bosses", 1), set("bossMax", add(260, mul(200, sub(v("bosses"), 1)))), set("bossHp", v("bossMax")),
    set("bossX", 0), set("bossY", 280), set("bossT", 0), set("bossOn", 1), set("bossHit", 0), set("wstate", "boss"), set("bossPhase", 1),
  ], { warp: true, x: 4700, y: 20 });

  define("boss", [
    change("bossT", 1), ifThen(gt(v("bossHit"), 0), [change("bossHit", -1)]),
    // It slides in, then sways.
    ifElse(lt(v("bossT"), 90), [set("bossY", sub(280, mul(div(v("bossT"), 90), 192)))], [
      set("bossX", mul(120, sin(mul(sub(v("bossT"), 90), 1.2)))), set("bossY", add(88, mul(10, sin(mul(v("bossT"), 2.3))))),
      set("bf", div(v("bossHp"), v("bossMax"))),
      // Power for the fight: one now and then, and a cluster when a new phase starts.
      ifThen(eq(mod(v("bossT"), 330), 0), [call("drop %s %s %s", random(-180, 180), 200, 1)]),
      ifThen(or(and(eq(v("bossPhase"), 1), lt(v("bf"), 0.67)), and(eq(v("bossPhase"), 2), lt(v("bf"), 0.34))), [
        change("bossPhase", 1), call("power cluster %s", random(-150, 150))]),
      // Phase 1: aimed shots from both cannons and a ring now and then.
      ifThen(eq(mod(v("bossT"), max(26, sub(44, mul(4, v("bosses"))))), 0), [
        set("q", -1), repeat(2, [
          ...compute("a", [fn("aim %s %s", add(v("bossX"), mul(70, v("q"))), sub(v("bossY"), 30))]),
          call("shot %s %s %s %s %s", add(v("bossX"), mul(70, v("q"))), sub(v("bossY"), 30), v("a"), 4, 2), change("q", 2)])]),
      ifThen(eq(mod(v("bossT"), 110), 0), [set("q", 0), repeat(12, [call("shot %s %s %s %s %s", v("bossX"), v("bossY"), add(mul(30, v("q")), v("bossT")), 2.4, 1), change("q", 1)])]),
      // Phase 2: a sweeping spray from the core.
      ifThen(and(lt(v("bf"), 0.67), eq(mod(v("bossT"), 7), 0)), [
        call("shot %s %s %s %s %s", v("bossX"), sub(v("bossY"), 10), add(180, mul(55, sin(mul(v("bossT"), 3)))), 3.2, 1)]),
      // Phase 3: a double spiral.
      ifThen(and(lt(v("bf"), 0.34), eq(mod(v("bossT"), 5), 0)), [
        call("shot %s %s %s %s %s", v("bossX"), v("bossY"), mul(v("bossT"), 11), 2.6, 1),
        call("shot %s %s %s %s %s", v("bossX"), v("bossY"), add(180, mul(v("bossT"), 11)), 2.6, 1)]),
    ]),
    ifThen(not(gt(v("bossHp"), 0)), [set("bossHp", 0), set("wstate", "bossdown"), set("wT", 100),
      set("i", 1), repeat(EB, [eb.set("on", v("i"), 0), change("i", 1)])]),
  ], { warp: true, x: 4700, y: 400 });

  define("boss down", [
    change("wT", -1),
    // A chain of explosions over the hull, then the big one.
    ifThen(eq(mod(v("wT"), 6), 0), [...emit(d, "debris", add(v("bossX"), random(-90, 90)), add(v("bossY"), random(-40, 40)), 5),
      ...emit(d, "ember", add(v("bossX"), random(-90, 90)), add(v("bossY"), random(-40, 40)), 4), set("shake", 6)]),
    ifThen(eq(v("wT"), 20), [
      set("bossOn", 0), set("shake", 22), set("flashKind", "white"), broadcast("flash"),
      ...emit(d, "ring", v("bossX"), v("bossY"), 1), ...emit(d, "debris", v("bossX"), v("bossY"), 16), ...emit(d, "smoke", v("bossX"), v("bossY"), 6),
      set("bonus", mul(20000, v("bosses"))), change("score", v("bonus")),
      ...write(d, { text: "word-bossdown", x: 0, y: 50, size: 110, group: G.banner }), pulse(d, G.banner, 60),
      ...write(d, { text: join("+", v("bonus")), x: 0, y: -10, size: 70, group: G.bannerNum }), pulse(d, G.bannerNum, 60),
      repeat(5, [...emit(d, "confetti", random(-200, 200), 180, 10)]),
      call("drop %s %s %s", sub(v("bossX"), 40), v("bossY"), 1), call("drop %s %s %s", v("bossX"), v("bossY"), 2), call("drop %s %s %s", add(v("bossX"), 40), v("bossY"), 3),
      // A new sector of space.
      set("sector", add(mod(v("sector"), SECTORS.length), 1)), switchBackdrop(item("sectors", v("sector"))),
    ]),
    ifThen(not(gt(v("wT"), 0)), [set("wstate", "clear"), set("wT", 120)]),
  ], { warp: true, x: 4700, y: 1300 });

  // ---------------------------------------------------------------- game over
  B.script(whenReceive("game over"), [
    ...[G.chainWord, G.chainNum, G.mult].flatMap(g => clear(d, g)),
    repeat(6, [...emit(d, "debris", add(v("px"), random(-20, 20)), add(v("py"), random(-20, 20)), 5), ...emit(d, "ember", v("px"), v("py"), 4), set("shake", 10), wait(0.1)]),
    ...write(d, { text: "word-gameover", x: 0, y: 70, size: 110, group: G.banner }), pulse(d, G.banner, 40),
    ...write(d, { text: v("score"), x: 0, y: 0, size: 90, group: G.bannerNum }),
    ifThen(gt(v("score"), v("best")), [set("best", v("score")),
      ...write(d, { text: "word-best", x: 0, y: -50, size: 56, group: G.bestWord }), pulse(d, G.bestWord, 50),
      repeat(4, [...emit(d, "confetti", random(-200, 200), 190, 10)])]),
    wait(1.5),
    ...write(d, { text: "word-clickplay", x: 0, y: -110, size: 50, group: G.click }),
    set("phase", "ready"),
  ], 20, 2300);

  define("roll score", [
    ifThen(and(not(eq(v("shown"), v("score"))), not(eq(v("phase"), "title"))), [
      ifElse(lt(v("shown"), 0), [set("shown", 0)], [change("shown", ceiling(div(sub(v("score"), v("shown")), 6)))]),
      ifThen(gt(v("shown"), v("score")), [set("shown", v("score"))]),
      ...write(d, { text: v("shown"), x: -165, y: 162, size: 40, group: G.score }), pulse(d, G.score, 10),
    ]),
  ], { warp: true, x: 5300, y: 20 });
  void until; void round; void length; void join;
  return B;
}
// ---------------------------------------------------------------- sprites: pools that draw their rows
function poolSprite(n: number, draw: (d: D) => any[]): Blocks {
  const B = new Blocks(P).local("isClone", "i");
  const d = dsl(B);
  B.script(d.whenFlag(), [d.hide(), d.set("isClone", 0), d.set("i", 1), d.repeat(n, [d.cloneMyself(), d.change("i", 1)])], 20, 20);
  B.script(d.whenCloned(), [d.set("isClone", 1)], 20, 160);
  B.script(d.whenReceive("tick"), [d.ifThen(d.eq(d.v("isClone"), 1), draw(d))], 20, 240);
  return B;
}
const at = (d: D, x: In, y: In) => d.goto(d.add(x, d.v("shakeX")), d.add(y, d.v("shakeY")));

const playerShots = () => poolSprite(PB, d => { const r = pbRec(d), i = d.v("i");
  return [d.ifElse(d.eq(r.get("on", i), 1), [d.ifElse(d.gt(d.v("gun"), 3), [d.costume("gold")], [d.costume("blue")]),
    d.point(d.add(90, d.atan(d.div(r.get("vx", i), r.get("vy", i))))), at(d, r.get("x", i), r.get("y", i)), d.show()], [d.hide()])]; });
const enemies = () => poolSprite(EN, d => { const r = enRec(d), i = d.v("i");
  return [d.ifElse(d.eq(r.get("on", i), 1), [d.costumeTo(r.get("kind", i)),
    d.setEffect("BRIGHTNESS", d.mul(25, r.get("hit", i))),
    d.ifElse(d.eq(r.get("kind", i), K.spinner), [d.point(d.add(90, d.mul(r.get("t", i), 6)))], [d.point(90)]),
    at(d, r.get("x", i), r.get("y", i)), d.show()], [d.hide()])]; });
const enemyShots = () => poolSprite(EB, d => { const r = ebRec(d), i = d.v("i");
  return [d.ifElse(d.eq(r.get("on", i), 1), [d.costumeTo(r.get("k", i)), d.point(d.add(90, r.get("dir", i))),
    at(d, r.get("x", i), r.get("y", i)), d.show()], [d.hide()])]; });
const steelSprite = () => poolSprite(OB, d => { const r = obRec(d), i = d.v("i");
  return [d.ifElse(d.eq(r.get("on", i), 1), [d.costumeTo(r.get("kind", i)), at(d, r.get("x", i), r.get("y", i)), d.show()], [d.hide()])]; });
const powerups = () => poolSprite(PU, d => { const r = puRec(d), i = d.v("i");
  return [d.ifElse(d.eq(r.get("on", i), 1), [d.costumeTo(r.get("kind", i)), d.setSize(d.add(100, d.mul(8, d.sin(d.mul(r.get("t", i), 12))))),
    at(d, r.get("x", i), r.get("y", i)), d.show()], [d.hide()])]; });

// Two star layers, two copies each, scrolling down at different speeds (parallax).
function starScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "layer", "sy");
  const d = dsl(B);
  const { v, add, mul, eq, lt, set, change, ifThen, whenFlag, whenReceive, whenCloned, hide, show, goto, cloneMyself, costume, back } = d;
  B.script(whenFlag(), [hide(), set("isClone", 0),
    ...[[1, 0], [1, 360], [2, 0], [2, 360]].flatMap(([l, y]) => [set("layer", l), set("sy", y), cloneMyself()])], 20, 20);
  B.script(whenCloned(), [set("isClone", 1), ifThen(eq(v("layer"), 1), [costume("far")]), ifThen(eq(v("layer"), 2), [costume("near")]), back(10), show()], 20, 200);
  B.script(whenReceive("tick"), [ifThen(eq(v("isClone"), 1), [
    change("sy", mul(-1, mul(v("layer"), v("scroll")))),
    ifThen(lt(v("sy"), -360), [change("sy", 720)]),
    goto(0, v("sy")),
  ])], 20, 300);
  return B;
}
function shipScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const { v, eq, or, gt, lt, mod, ifElse, whenFlag, whenReceive, hide, show, costumeTo, join, floor, div, and } = d;
  B.script(whenFlag(), [hide()], 20, 20);
  B.script(whenReceive("tick"), [
    ifElse(eq(v("phase"), "play"), [
      costumeTo(join("ship", mod(floor(div(v("frame"), 3)), 3))), at(d, v("px"), v("py")),
      // Blinks while it cannot be hit.
      ifElse(and(gt(v("inv"), 0), lt(mod(v("frame"), 6), 3)), [hide()], [show()])], [hide()]),
  ], 20, 100);
  void or;
  return B;
}
function shieldScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.hide()], 20, 20);
  B.script(d.whenReceive("tick"), [d.ifElse(d.and(d.eq(d.v("phase"), "play"), d.gt(d.v("shieldT"), 0)), [
    at(d, d.v("px"), d.v("py")), d.setSize(d.add(100, d.mul(5, d.sin(d.mul(d.v("frame"), 15))))),
    // It flickers when about to run out.
    d.ifElse(d.and(d.lt(d.v("shieldT"), 60), d.lt(d.mod(d.v("frame"), 6), 3)), [d.hide()], [d.show()])], [d.hide()])], 20, 100);
  return B;
}
function bossScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.hide()], 20, 20);
  B.script(d.whenReceive("tick"), [d.ifElse(d.eq(d.v("bossOn"), 1), [
    d.setEffect("BRIGHTNESS", d.mul(20, d.v("bossHit"))), at(d, d.v("bossX"), d.v("bossY")), d.show()], [d.hide()])], 20, 100);
  return B;
}
function barScripts(kind: "hp" | "gun" | "boss" | "energy"): Blocks {
  const B = new Blocks(P), d = dsl(B);
  const pos = kind === "hp" ? [-232, -168] : kind === "gun" ? [-100, -163] : kind === "energy" ? [-100, -175] : [0, 128];
  B.script(d.whenFlag(), [d.hide(), d.goto(pos[0], pos[1])], 20, 20);
  const shown = kind === "boss" ? d.and(d.eq(d.v("bossOn"), 1), d.eq(d.v("phase"), "play")) : d.eq(d.v("phase"), "play");
  const value = kind === "hp" ? d.v("hp") : kind === "gun" ? d.v("gun") : kind === "energy" ? d.ceiling(d.mul(20, d.div(d.v("energy"), ENERGY_FULL)))
    : d.ceiling(d.mul(20, d.div(d.v("bossHp"), d.v("bossMax"))));
  // The energy meter only shows above gun level 1, and blinks when nearly empty.
  const visible = kind === "energy" ? [d.ifElse(d.and(d.gt(d.v("gun"), 1), d.not(d.and(d.lt(d.v("energy"), 25), d.lt(d.mod(d.v("frame"), 8), 4)))), [d.show()], [d.hide()])] : [d.show()];
  B.script(d.whenReceive("tick"), [d.ifElse(shown, [d.costumeTo(d.join(kind, d.max(0, d.min(20, value)))), ...visible], [d.hide()])], 20, 100);
  return B;
}
function flashScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.hide()], 20, 20);
  B.script(d.whenReceive("flash"), [d.costumeTo(d.v("flashKind")), d.setEffect("GHOST", 60), d.show(), d.front()], 20, 100);
  B.script(d.whenReceive("tick"), [d.changeEffect("GHOST", 10)], 20, 220);
  return B;
}
function hudScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, 160), d.show()], 20, 20);
  return B;
}
const clickable = (B: Blocks) => { const d = dsl(B); B.script(d.whenClicked(), [d.broadcast("other click")], 300, 20); return B; };

const A = art(P);
const gunFlat = GUNS.flat();
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Stars", { blocks: clickable(starScripts()), costumes: A.stars, layer: 1, visible: false }),
    P.sprite("Steel", { blocks: clickable(steelSprite()), costumes: A.steel, layer: 2, visible: false }),
    P.sprite("Powerup", { blocks: clickable(powerups()), costumes: A.powerup, layer: 2, visible: false }),
    P.sprite("Enemy", { blocks: clickable(enemies()), costumes: A.enemy, layer: 3, visible: false }),
    P.sprite("Boss", { blocks: clickable(bossScripts()), costumes: A.boss, layer: 4, visible: false }),
    P.sprite("Shot", { blocks: clickable(playerShots()), costumes: A.pshot, layer: 5, visible: false }),
    P.sprite("Ship", { blocks: clickable(shipScripts()), costumes: A.ship, layer: 6, visible: false }),
    P.sprite("Shield", { blocks: clickable(shieldScripts()), costumes: A.shield, layer: 7, visible: false }),
    P.sprite("EnemyShot", { blocks: clickable(enemyShots()), costumes: A.eshot, layer: 8, visible: false }),
    P.sprite("Spark", { blocks: sparkScripts(P), costumes: sparkCostumes(P), layer: 9, visible: false }),
    P.sprite("Hud", { blocks: clickable(hudScripts()), costumes: A.hud, layer: 10, x: 0, y: 160 }),
    P.sprite("HpBar", { blocks: clickable(barScripts("hp")), costumes: A.hpBar, layer: 11, visible: false }),
    P.sprite("GunBar", { blocks: clickable(barScripts("gun")), costumes: A.gunBar, layer: 12, visible: false }),
    P.sprite("EnergyBar", { blocks: clickable(barScripts("energy")), costumes: A.energyBar, layer: 12, visible: false }),
    P.sprite("BossBar", { blocks: clickable(barScripts("boss")), costumes: A.bossBar, layer: 13, visible: false }),
    P.sprite("Text", { blocks: textScripts(P), costumes: textCostumes(P, "starfire-rush"), layer: 14, visible: false }),
    P.sprite("Flash", { blocks: clickable(flashScripts()), costumes: A.flash, layer: 15, visible: false }),
  ],
  listValues: {
    ...kitLists(),
    ...Object.fromEntries((["on", "x", "y", "vx", "vy"]).map(f => [`pb.${f}`, Array(PB).fill(0)])),
    ...Object.fromEntries((["on", "kind", "x", "y", "bx", "sy", "vx", "vy", "hp", "t", "fire", "hit", "st"]).map(f => [`en.${f}`, Array(EN).fill(0)])),
    ...Object.fromEntries((["on", "x", "y", "vx", "vy", "k", "dir"]).map(f => [`eb.${f}`, Array(EB).fill(0)])),
    ...Object.fromEntries((["on", "x", "y", "kind", "t"]).map(f => [`pu.${f}`, Array(PU).fill(0)])),
    ...Object.fromEntries((["on", "x", "y", "kind", "hw", "hh"]).map(f => [`ob.${f}`, Array(OB).fill(0)])),
    steelHw: STEEL.map(s => s.w / 2), steelHh: STEEL.map(s => s.h / 2),
    enHp: ENEMIES.map(e => e.hp), enR: ENEMIES.map(e => e.r), enScore: ENEMIES.map(e => e.score),
    gunStart: GUNS.map((_, i) => GUNS.slice(0, i).reduce((n, g) => n + g.length, 0) + 1), gunCount: GUNS.map(g => g.length),
    gunDx: gunFlat.map(s => s[0]), gunAng: gunFlat.map(s => s[1]),
    signs: [1, -1], sectors: SECTORS, gunCost: GUN_COST,
  },
  shown: [],
});
writeFileSync(new URL("starfire-rush.sb3", import.meta.url), sb3);
console.log(`starfire-rush.sb3: ${sb3.length} bytes`);
