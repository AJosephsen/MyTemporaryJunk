// Builds dust-hopper.sb3: a single-screen landing game for Scratch 3.
// Physics follow the per-frame model of the 1979 arcade lander:
//   thrust table lookup -> split by sin/cos of angle -> v += thrust - gravity -> pos += v
// Run: node --experimental-strip-types --no-warnings build.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { PADS, THRUST_TABLE, art } from "./art.ts";

const P = new Project();

// Ground and Pads only need to sit at the centre of the Stage.
function staticSprite(): Blocks {
  const B = new Blocks(P), d = dsl(B);
  B.script(d.whenFlag(), [d.goto(0, 0), d.show()]);
  return B;
}

function droneScripts(): Blocks {
  const B = new Blocks(P);
  const { v, add, sub, mul, div, lt, gt, eq, and, or, not, sin, cos, abs, round, join, item, length, set, change,
    key, touching, direction, goto, point, turn, costume, show, front, say, sayFor, broadcast, whenFlag, whenReceive,
    ifThen, ifElse, repeat, until, stopThis } = dsl(B);

  B.script(whenFlag(), [
    set("gravity", 0.035), set("Score", 0), set("fuelLeft", 1000), set("Fuel", 1000),
    set("Throttle", 0), set("Drift", 0), set("Descent", 0),
    goto(-60, 150), point(90), costume("drone"), show(), front(),
    sayFor("Up/Down: throttle. Left/Right: tilt. Space: boost. Land gently on a yellow pad!", 4),
    broadcast("new round"),
  ], 20, 20);

  // Landing check: find the pad under the drone, then apply the original rules
  // (upright within one rotation step, low sideways speed, descent speed decides good/hard/crash).
  const landingCheck = [
    set("mult", 0), set("i", 1),
    repeat(length("padLeft"), [
      ifThen(and(gt(v("posX"), item("padLeft", v("i"))), lt(v("posX"), item("padRight", v("i")))),
        [set("mult", item("padMult", v("i")))]),
      change("i", 1),
    ]),
    ifElse(or(or(eq(v("mult"), 0), gt(abs(v("angle")), 12)), gt(abs(v("vx")), 1)),
      [set("state", "crash")],
      [ifElse(lt(mul(v("vy"), -1), 1), [set("state", "good")],
        [ifElse(lt(mul(v("vy"), -1), 1.8), [set("state", "hard")], [set("state", "crash")])])]),
  ];

  const frame = [
    // Controls: one step per press, repeating while held.
    ifElse(gt(v("cooldown"), 0), [change("cooldown", -1)], [
      ifThen(and(key("up arrow"), lt(v("Throttle"), 15)), [change("Throttle", 1), set("cooldown", 3)]),
      ifThen(and(key("down arrow"), gt(v("Throttle"), 0)), [change("Throttle", -1), set("cooldown", 3)]),
      ifThen(key("right arrow"), [turn(11.25), set("cooldown", 4)]),
      ifThen(key("left arrow"), [turn(-11.25), set("cooldown", 4)]),
    ]),
    set("level", v("Throttle")),
    ifThen(key("space"), [set("level", 16)]),
    ifThen(lt(v("fuelLeft"), 0.01), [set("level", 0)]),
    // Thrust from the table, scaled so that table value 17 equals gravity.
    set("force", mul(item("thrustTable", add(v("level"), 1)), div(v("gravity"), 17))),
    change("fuelLeft", mul(item("thrustTable", add(v("level"), 1)), -0.05)),
    ifThen(lt(v("fuelLeft"), 0), [set("fuelLeft", 0)]),
    // Angle from upright: 0 = upright, positive = tilted right.
    set("angle", sub(direction(), 90)),
    ifThen(lt(v("angle"), -180), [change("angle", 360)]),
    change("vx", mul(v("force"), sin(v("angle")))),
    change("vy", sub(mul(v("force"), cos(v("angle"))), v("gravity"))),
    change("posX", v("vx")), change("posY", v("vy")),
    // Wrap sideways and cap the top, using our own position variables.
    ifThen(gt(v("posX"), 230), [change("posX", -460)]),
    ifThen(lt(v("posX"), -230), [change("posX", 460)]),
    ifThen(gt(v("posY"), 165), [set("posY", 165), ifThen(gt(v("vy"), 0), [set("vy", 0)])]),
    goto(v("posX"), v("posY")),
    // Test collisions with the plain costume so the flame never counts.
    costume("drone"),
    ifElse(touching("Pads"), landingCheck, [ifThen(touching("Ground"), [set("state", "crash")])]),
    ifThen(and(eq(v("state"), "flying"), gt(v("level"), 0)),
      [ifElse(lt(v("level"), 9), [costume("drone-flame")], [costume("drone-boost")])]),
    set("Fuel", round(v("fuelLeft"))),
    set("Drift", round(mul(v("vx"), 10))),
    set("Descent", round(mul(v("vy"), -10))),
  ];

  B.script(whenReceive("new round"), [
    set("posX", -60), set("posY", 150), set("vx", 1.2), set("vy", 0),
    set("Throttle", 0), set("cooldown", 0), set("state", "flying"),
    point(90), costume("drone"), show(), front(),
    until(not(eq(v("state"), "flying")), frame),
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
    ifElse(gt(v("fuelLeft"), 0), [broadcast("new round")],
      [say(join("Out of fuel. Final score: ", v("Score"))), stopThis()]),
  ], 20, 420);

  return B;
}

const A = art(P);
const sb3 = P.build({
  backdrop: A.backdrop,
  sprites: [
    P.sprite("Ground", { blocks: staticSprite(), costumes: A.ground, layer: 1 }),
    P.sprite("Pads", { blocks: staticSprite(), costumes: A.pads, layer: 2 }),
    P.sprite("Drone", { blocks: droneScripts(), costumes: A.drone, layer: 3, x: -60, y: 150 }),
  ],
  listValues: {
    thrustTable: THRUST_TABLE,
    padLeft: PADS.map(p => p.l), padRight: PADS.map(p => p.r), padMult: PADS.map(p => p.mult),
  },
  shown: ["Score", "Fuel", "Throttle", "Drift", "Descent"],
});
writeFileSync(new URL("dust-hopper.sb3", import.meta.url), sb3);
console.log(`dust-hopper.sb3: ${sb3.length} bytes`);
