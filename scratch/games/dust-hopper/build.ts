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
      call("check touchdown"), call("show flame"), call("update displays"),
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
    set("Drift", round(mul(v("vx"), 10))),
    set("Descent", round(mul(v("vy"), -10))),
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

// ---------------------------------------------------------------- project
const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  stage: stageScripts(),
  sprites: [
    P.sprite("Ground", { blocks: groundScripts(), costumes: A.ground, layer: 1 }),
    P.sprite("Pads", { blocks: padScripts(), costumes: A.pads, layer: 2 }),
    P.sprite("Drone", { blocks: droneScripts(), costumes: A.drone, layer: 3, x: -60, y: 150 }),
  ],
  listValues: { thrustTable: THRUST_TABLE },
  shown: ["Score", "Fuel", "Throttle", "Drift", "Descent"],
});
writeFileSync(new URL("dust-hopper.sb3", import.meta.url), sb3);
console.log(`dust-hopper.sb3: ${sb3.length} bytes`);
