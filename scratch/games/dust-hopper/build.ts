// Builds dust-hopper.sb3: a single-screen landing game for Scratch 3.
// Physics follow the per-frame model of the 1979 arcade lander:
//   thrust table lookup -> split by sin/cos of angle -> v += thrust - gravity -> pos += v
//
// Structure: no game loop in any sprite. The Stage broadcasts [tick] once per frame, and the game moves
// through named phases, each a broadcast:
//   setup       (broadcast and wait)  every sprite prepares, in a fixed order before play starts
//   new round   the drone resets and starts flying
//   tick        once per frame: the drone runs its per-frame work as custom blocks, in a fixed order
//   round over  the drone shows the result, then starts a new round or ends the game
//   game over   the final score
// Tick scripts never pause (no waits, and the one loop runs without screen refresh), so each tick
// finishes within its frame and is never restarted half-way by the next tick.
//
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { PADS, THRUST_TABLE, art } from "./art.ts";

const P = new Project();
const INSTRUCTIONS = "Up/Down: throttle. Left/Right: tilt. Space: boost. Land gently on a yellow pad!";

// ---------------------------------------------------------------- Stage: the clock and the game totals
function stageScripts(): Blocks {
  const B = new Blocks(P);
  const { set, whenFlag, whenReceive, broadcast, broadcastWait, forever } = dsl(B);
  B.script(whenFlag(), [broadcastWait("setup"), broadcast("new round"), forever([broadcast("tick")])], 20, 20);
  B.script(whenReceive("setup"), [
    set("gravity", 0.035), set("Score", 0), set("fuelLeft", 1000), set("Fuel", 1000),
    set("Throttle", 0), set("Drift", 0), set("Descent", 0), set("state", "waiting"),
  ], 20, 220);
  return B;
}

// ---------------------------------------------------------------- Ground and Pads
function groundScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenReceive("setup"), [d.goto(0, 0), d.show()]);
  return B;
}

function padScripts(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  // The pads know where they are: left edge, right edge and score multiplier, one list row per pad.
  B.script(d.whenReceive("setup"), [
    d.goto(0, 0), d.show(),
    d.deleteAll("padLeft"), d.deleteAll("padRight"), d.deleteAll("padMult"),
    ...PADS.flatMap(p => [d.addTo("padLeft", p.l), d.addTo("padRight", p.r), d.addTo("padMult", p.mult)]),
  ]);
  return B;
}

// ---------------------------------------------------------------- Drone
function droneScripts(): Blocks {
  const B = new Blocks(P);
  const { v, add, sub, mul, div, lt, gt, eq, and, or, not, sin, cos, abs, round, join, item, length, set, change,
    key, touching, direction, goto, point, turn, turnLeft, costume, show, front, say, sayFor, broadcast,
    whenReceive, ifThen, ifElse, repeat, define, call } = dsl(B);
  let y = 20;
  const at = () => { const r = y; y += 400; return r; };

  B.script(whenReceive("setup"), [
    goto(-60, 150), point(90), costume("drone"), show(), front(), sayFor(INSTRUCTIONS, 4),
  ], 20, at());

  B.script(whenReceive("new round"), [
    set("posX", -60), set("posY", 150), set("vx", 1.2), set("vy", 0),
    set("Throttle", 0), set("cooldown", 0),
    point(90), costume("drone"), show(), front(), goto(v("posX"), v("posY")),
    set("state", "flying"),
  ], 20, at());

  // The per-frame work, in a fixed order. Each line is a custom block defined below.
  B.script(whenReceive("tick"), [
    ifThen(eq(v("state"), "flying"), [
      call("read controls"), call("run engine"), call("move"), call("place on screen"),
      call("update displays"), call("check touchdown"), call("show flame"),
    ]),
  ], 20, at());

  B.script(whenReceive("round over"), [
    ifThen(eq(v("state"), "good"), [
      change("Score", mul(50, v("mult"))), change("fuelLeft", 50),
      sayFor(join("Perfect landing! x", v("mult")), 2)]),
    ifThen(eq(v("state"), "hard"), [
      change("Score", mul(15, v("mult"))),
      sayFor(join("Hard landing. x", v("mult")), 2)]),
    ifThen(eq(v("state"), "crash"), [
      costume("boom"), change("fuelLeft", -150),
      ifThen(lt(v("fuelLeft"), 0), [set("fuelLeft", 0)]),
      sayFor("Crashed! -150 fuel", 2)]),
    set("Fuel", round(v("fuelLeft"))),
    ifElse(gt(v("fuelLeft"), 0), [broadcast("new round")], [broadcast("game over")]),
  ], 20, at());

  B.script(whenReceive("game over"), [say(join("Out of fuel. Final score: ", v("Score")))], 20, at());

  // ---- custom blocks, one job each
  define("read controls", [
    // One step per key press, repeating while the key is held.
    ifElse(gt(v("cooldown"), 0), [change("cooldown", -1)], [
      ifThen(and(key("up arrow"), lt(v("Throttle"), 15)), [change("Throttle", 1), set("cooldown", 3)]),
      ifThen(and(key("down arrow"), gt(v("Throttle"), 0)), [change("Throttle", -1), set("cooldown", 3)]),
      ifThen(key("right arrow"), [turn(11.25), set("cooldown", 4)]),
      ifThen(key("left arrow"), [turnLeft(11.25), set("cooldown", 4)]),
    ]),
  ], { x: 600, y: 20 });

  define("run engine", [
    // Thrust from the 1979 table (TRSTAB); table value 17 equals gravity. Space boosts.
    set("level", v("Throttle")),
    ifThen(key("space"), [set("level", 16)]),
    ifThen(lt(v("fuelLeft"), 0.01), [set("level", 0)]),
    set("force", mul(item("thrustTable", add(v("level"), 1)), div(v("gravity"), 17))),
    change("fuelLeft", mul(item("thrustTable", add(v("level"), 1)), -0.05)),
    ifThen(lt(v("fuelLeft"), 0), [set("fuelLeft", 0)]),
  ], { x: 600, y: 420 });

  define("move", [
    // angle: 0 = upright, positive = tilted right.
    set("angle", sub(direction(), 90)),
    ifThen(lt(v("angle"), -180), [change("angle", 360)]),
    change("vx", mul(v("force"), sin(v("angle")))),
    change("vy", sub(mul(v("force"), cos(v("angle"))), v("gravity"))),
    change("posX", v("vx")),
    change("posY", v("vy")),
  ], { x: 600, y: 760 });

  define("place on screen", [
    // Wrap sideways and cap the top using our own position, then show the drone there.
    ifThen(gt(v("posX"), 230), [change("posX", -460)]),
    ifThen(lt(v("posX"), -230), [change("posX", 460)]),
    ifThen(gt(v("posY"), 165), [set("posY", 165), ifThen(gt(v("vy"), 0), [set("vy", 0)])]),
    goto(v("posX"), v("posY")),
  ], { x: 600, y: 1100 });

  define("check touchdown", [
    // Plain costume first, so the flame never counts as touching.
    costume("drone"),
    ifElse(touching("Pads"), [call("judge landing")], [ifThen(touching("Ground"), [set("state", "crash")])]),
    ifThen(not(eq(v("state"), "flying")), [broadcast("round over")]),
  ], { x: 600, y: 1400 });

  // Runs without screen refresh, so its loop never pauses inside a tick.
  define("judge landing", [
    set("mult", 0), set("i", 1),
    repeat(length("padLeft"), [
      ifThen(and(gt(v("posX"), item("padLeft", v("i"))), lt(v("posX"), item("padRight", v("i")))),
        [set("mult", item("padMult", v("i")))]),
      change("i", 1),
    ]),
    ifElse(or(or(eq(v("mult"), 0), gt(abs(v("angle")), 12)), gt(abs(v("Drift")), 10)),
      [set("state", "crash")],
      [ifElse(lt(v("Descent"), 10), [set("state", "good")],
        [ifElse(lt(v("Descent"), 18), [set("state", "hard")], [set("state", "crash")])])]),
  ], { warp: true, x: 1100, y: 20 });

  define("show flame", [
    ifThen(and(eq(v("state"), "flying"), gt(v("level"), 0)),
      [ifElse(lt(v("level"), 9), [costume("drone-flame")], [costume("drone-boost")])]),
  ], { x: 1100, y: 600 });

  define("update displays", [
    set("Fuel", round(v("fuelLeft"))),
    set("Drift", round(mul(v("vx"), 10))),
    set("Descent", round(mul(v("vy"), -10))),
  ], { x: 1100, y: 800 });

  return B;
}

// ---------------------------------------------------------------- Particles: exhaust fire, smoke and explosions
// The original Particle sprite stays hidden and acts as the emitter. Every particle is a clone with its own
// speed and lifetime (variables for this sprite only), and moves itself on each tick.
function particleScripts(): Blocks {
  const B = new Blocks(P).local("isClone", "kind", "pvx", "pvy", "life", "maxLife", "speed", "startSize", "grow");
  const { v, add, sub, mul, div, lt, gt, eq, and, or, not, sin, cos, round, random, set, change, touching, goto,
    costume, show, hide, whenReceive, ifThen, ifElse, repeat, define, call, changeX, changeY, setEffect,
    changeEffect, clearEffects, setSize, changeSize, cloneMyself, whenCloned, deleteClone } = dsl(B);
  // age goes from 0 (new) to 1 (about to disappear)
  const age = () => sub(1, div(v("life"), v("maxLife")));
  const fadeIn = (start: number) => setEffect("GHOST", add(start, mul(age(), 100 - start)));

  B.script(whenReceive("setup"), [hide(), set("isClone", 0)], 20, 20);

  B.script(whenReceive("tick"), [
    ifElse(eq(v("isClone"), 1), [call("update particle")], [
      ifThen(and(eq(v("state"), "flying"), gt(v("force"), 0)), [call("run exhaust")]),
    ]),
  ], 20, 160);

  B.script(whenReceive("round over"), [
    ifThen(and(eq(v("isClone"), 0), eq(v("state"), "crash")), [call("explode")]),
  ], 20, 520);

  // Loops inside a tick must finish within the frame, so these two run without screen refresh.
  // Exhaust: more particles at higher thrust.
  define("run exhaust", [
    repeat(add(1, round(mul(v("force"), 40))), [
      set("kind", "fire"), call("emit exhaust"),
      ifThen(eq(random(1, 3), 1), [set("kind", "smoke"), call("emit exhaust")]),
    ]),
  ], { warp: true, x: 1000, y: 20 });

  define("explode", [
    repeat(30, [
      set("kind", "blast"),
      ifThen(eq(random(1, 3), 1), [set("kind", "smoke")]),
      call("emit explosion"),
    ]),
  ], { warp: true, x: 1000, y: 300 });

  B.script(whenReceive("new round"), [ifThen(eq(v("isClone"), 1), [deleteClone()])], 20, 760);

  B.script(whenCloned(), [
    set("isClone", 1),
    clearEffects(),
    ifElse(eq(v("kind"), "smoke"), [costume("smoke"), setEffect("GHOST", 40)], [costume("fire")]),
    setSize(v("startSize")),
    show(),
  ], 20, 860);

  // Exhaust leaves the nozzle (10 px below the drone's centre) opposite to the thrust, moving with the drone.
  define("emit exhaust", [
    ifElse(eq(v("kind"), "fire"),
      [set("life", random(7, 11)), set("startSize", 100), set("grow", -6)],
      [set("life", random(25, 40)), set("startSize", 60), set("grow", 4)]),
    set("maxLife", v("life")),
    set("speed", div(random(20, 35), 10)),
    set("pvx", add(sub(v("vx"), mul(sin(v("angle")), v("speed"))), div(random(-5, 5), 10))),
    set("pvy", add(sub(v("vy"), mul(cos(v("angle")), v("speed"))), div(random(-5, 5), 10))),
    goto(sub(v("posX"), mul(sin(v("angle")), 10)), sub(v("posY"), mul(cos(v("angle")), 10))),
    cloneMyself(),
  ], { warp: true, x: 520, y: 20 });

  define("emit explosion", [
    ifElse(eq(v("kind"), "blast"),
      [set("life", random(12, 24)), set("startSize", random(140, 200)), set("grow", -4)],
      [set("life", random(30, 55)), set("startSize", 80), set("grow", 5)]),
    set("maxLife", v("life")),
    set("pvx", div(random(-35, 35), 10)),
    set("pvy", div(random(-10, 45), 10)),
    goto(v("posX"), v("posY")),
    cloneMyself(),
  ], { warp: true, x: 520, y: 380 });

  define("update particle", [
    changeX(v("pvx")), changeY(v("pvy")), change("life", -1), changeSize(v("grow")),
    ifElse(eq(v("kind"), "smoke"), [
      // Smoke slows down, drifts upwards and fades.
      set("pvx", mul(v("pvx"), 0.94)),
      set("pvy", add(mul(v("pvy"), 0.92), 0.03)),
      fadeIn(40),
    ], [
      // Fire slows down, turns from yellow to red (a hue shift of up to -18) and fades.
      set("pvx", mul(v("pvx"), 0.9)),
      set("pvy", mul(v("pvy"), 0.9)),
      setEffect("COLOR", mul(age(), -18)), fadeIn(0),
    ]),
    // Exhaust hitting the ground spreads sideways instead of going through it.
    ifThen(and(lt(v("pvy"), 0), or(touching("Ground"), touching("Pads"))), [
      set("pvy", 0), change("pvx", div(random(-20, 20), 10)),
    ]),
    ifThen(lt(v("life"), 1), [deleteClone()]),
  ], { x: 520, y: 700 });

  return B;
}

// ---------------------------------------------------------------- project
const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Ground", { blocks: groundScripts(), costumes: A.ground, layer: 1 }),
    P.sprite("Pads", { blocks: padScripts(), costumes: A.pads, layer: 2 }),
    P.sprite("Particle", { blocks: particleScripts(), costumes: A.particle(), layer: 3, visible: false }),
    P.sprite("Drone", { blocks: droneScripts(), costumes: A.drone, layer: 4, x: -60, y: 150 }),
  ],
  listValues: { thrustTable: THRUST_TABLE },
  shown: ["Score", "Fuel", "Throttle", "Drift", "Descent"],
});
writeFileSync(new URL("dust-hopper.sb3", import.meta.url), sb3);
console.log(`dust-hopper.sb3: ${sb3.length} bytes`);
