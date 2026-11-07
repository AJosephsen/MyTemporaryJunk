// Builds the Dust Hopper tutorial: one checkpoint .sb3 per step, and index.html from index.template.html.
//   starter.sb3   artwork only, no code
//   stepN.sb3     the project as it should be at the end of step N (1-8)
// Block pictures in the page are generated from the same checkpoints, so page and files always match.
// In the template, <!--blocks:N:Sprite--> becomes the scripts of that sprite at the end of step N.
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { readFileSync, writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art, PADS } from "../../games/dust-hopper/art.ts";
import { projectScripts } from "../../tools/scratchblocks/to-scratchblocks.ts";

const LAST = 8;
const INSTRUCTIONS = "Up/Down: throttle. Left/Right: tilt. Space: boost. Land gently on a yellow pad!";

function droneScripts(B: Blocks, step: number) {
  const { v, sub, mul, lt, gt, eq, and, or, not, sin, cos, abs, round, join, item, length, set, change,
    key, touching, direction, goto, point, turn, turnLeft, costume, show, front, say, sayFor, broadcast,
    whenFlag, whenReceive, ifThen, ifElse, repeat, until, stopThis, deleteAll, addTo } = dsl(B);
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  if (step === 1) {
    B.script(whenFlag(), [goto(-60, 150), point(90)]);
    return;
  }

  // Step 6: the landing pads, as three lists (left edge, right edge, score multiplier).
  const padSetup = () => [
    deleteAll("padLeft"), deleteAll("padRight"), deleteAll("padMult"),
    ...PADS.flatMap(p => [addTo("padLeft", p.l), addTo("padRight", p.r), addTo("padMult", p.mult)]),
  ];

  const start = [
    set("gravity", 0.035), set("posX", -60), set("posY", 150),
    ...when(4, () => [set("vx", 1.2)]),
    set("vy", 0),
    ...when(3, () => [set("Throttle", 0), set("cooldown", 0)]),
    ...when(6, () => [set("state", "flying"), costume("drone"), show()]),
    point(90), goto(v("posX"), v("posY")),
  ];

  // Step 3 (throttle) and step 4 (tilt): one step per key press, repeating while held.
  const controls = when(3, () => [ifElse(gt(v("cooldown"), 0), [change("cooldown", -1)], [
    ifThen(and(key("up arrow"), lt(v("Throttle"), 15)), [change("Throttle", 1), set("cooldown", 3)]),
    ifThen(and(key("down arrow"), gt(v("Throttle"), 0)), [change("Throttle", -1), set("cooldown", 3)]),
    ...when(4, () => [
      ifThen(key("right arrow"), [turn(11.25), set("cooldown", 4)]),
      ifThen(key("left arrow"), [turnLeft(11.25), set("cooldown", 4)]),
    ]),
  ])]);

  const thrust = when(3, () => [
    set("force", mul(v("Throttle"), 0.004)),
    ...when(8, () => [ifThen(key("space"), [set("force", 0.07)])]),
    ...when(7, () => [
      ifThen(lt(v("fuelLeft"), 0.01), [set("force", 0)]),
      change("fuelLeft", sub(0, mul(v("force"), 25))),
      ifThen(lt(v("fuelLeft"), 0), [set("fuelLeft", 0)]),
    ]),
  ]);

  const physics = at(4) ? [
    set("angle", sub(direction(), 90)),
    ifThen(lt(v("angle"), -180), [change("angle", 360)]),
    change("vx", mul(v("force"), sin(v("angle")))),
    change("vy", sub(mul(v("force"), cos(v("angle"))), v("gravity"))),
    change("posX", v("vx")),
    change("posY", v("vy")),
  ] : [
    change("vy", sub(at(3) ? v("force") : 0, v("gravity"))),
    change("posY", v("vy")),
  ];

  const edges = when(5, () => [
    ifThen(gt(v("posX"), 230), [change("posX", -460)]),
    ifThen(lt(v("posX"), -230), [change("posX", 460)]),
    ifThen(gt(v("posY"), 165), [set("posY", 165), ifThen(gt(v("vy"), 0), [set("vy", 0)])]),
  ]);

  const displays = [
    set("Descent", round(mul(v("vy"), -10))),
    ...when(4, () => [set("Drift", round(mul(v("vx"), 10)))]),
    ...when(7, () => [set("Fuel", round(v("fuelLeft")))]),
  ];

  // Step 6: find the pad under the drone, then judge the landing.
  const landingCheck = () => [
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
  ];

  const collisions = when(6, () => [
    ...when(8, () => [costume("drone")]),
    ifElse(touching("Pads"), landingCheck(), [ifThen(touching("Ground"), [set("state", "crash")])]),
    ...when(8, () => [ifThen(and(eq(v("state"), "flying"), gt(v("force"), 0)),
      [ifElse(lt(v("force"), 0.04), [costume("drone-flame")], [costume("drone-boost")])])]),
  ]);

  const loop = until(
    at(6) ? not(eq(v("state"), "flying")) : or(touching("Ground"), touching("Pads")),
    [...controls, ...thrust, ...physics, ...edges, goto(v("posX"), v("posY")), ...displays, ...collisions]);

  const results = at(6) ? [
    ifThen(eq(v("state"), "good"), [
      ...when(7, () => [change("Score", mul(50, v("mult"))), change("fuelLeft", 50)]),
      sayFor(join("Perfect landing! x", v("mult")), 2)]),
    ifThen(eq(v("state"), "hard"), [
      ...when(7, () => [change("Score", mul(15, v("mult")))]),
      sayFor(join("Hard landing. x", v("mult")), 2)]),
    ifThen(eq(v("state"), "crash"), [
      costume("boom"),
      ...when(7, () => [change("fuelLeft", -150), ifThen(lt(v("fuelLeft"), 0), [set("fuelLeft", 0)])]),
      sayFor(at(7) ? "Crashed! -150 fuel" : "Crashed!", 2)]),
    ...when(7, () => [
      set("Fuel", round(v("fuelLeft"))),
      ifElse(gt(v("fuelLeft"), 0), [broadcast("new round")],
        [say(join("Out of fuel. Final score: ", v("Score"))), stopThis()]),
    ]),
  ] : [sayFor(join("Touchdown! Descent: ", v("Descent")), 2)];

  if (!at(7)) {
    B.script(whenFlag(), [...when(6, padSetup), ...start, loop, ...results]);
    return;
  }
  // Step 7: the game is a series of rounds. The green flag starts the game; each round is a broadcast.
  B.script(whenFlag(), [
    ...padSetup(),
    set("Score", 0), set("fuelLeft", 1000), set("Fuel", 1000),
    ...when(8, () => [set("Throttle", 0), set("Drift", 0), set("Descent", 0),
      goto(-60, 150), point(90), costume("drone"), show(), front(), sayFor(INSTRUCTIONS, 4)]),
    broadcast("new round"),
  ], 20, 20);
  B.script(whenReceive("new round"), [...start, loop, ...results], 20, 700);
}

function shownVariables(step: number): string[] {
  if (step >= 7) return ["Score", "Fuel", "Throttle", "Drift", "Descent"];
  if (step >= 4) return ["Throttle", "Drift", "Descent"];
  if (step === 3) return ["Throttle", "Descent"];
  return step === 2 ? ["Descent"] : [];
}

function checkpoint(step: number): Buffer {
  const P = new Project();
  const A = art(P);
  const ground = new Blocks(P), pads = new Blocks(P), drone = new Blocks(P);
  if (step >= 1) {
    for (const B of [ground, pads]) { const d = dsl(B); B.script(d.whenFlag(), [d.goto(0, 0)]); }
    droneScripts(drone, step);
  }
  return P.build({
    backdrop: A.backdrop,
    sprites: [
      P.sprite("Ground", { blocks: ground, costumes: A.ground, layer: 1 }),
      P.sprite("Pads", { blocks: pads, costumes: A.pads, layer: 2 }),
      P.sprite("Drone", { blocks: drone, costumes: A.drone, layer: 3, x: -60, y: 150 }),
    ],
    shown: shownVariables(step),
  });
}

// Reads project.json back out of a stored (uncompressed) zip built by zip().
function projectJson(sb3: Buffer): any {
  const nameLen = sb3.readUInt16LE(26), size = sb3.readUInt32LE(18);
  return JSON.parse(sb3.subarray(30 + nameLen, 30 + nameLen + size).toString());
}

const here = (f: string) => new URL(f, import.meta.url);
const blockText: Record<string, string> = {};
for (let step = 0; step <= LAST; step++) {
  const sb3 = checkpoint(step);
  const name = step === 0 ? "starter.sb3" : `step${step}.sb3`;
  writeFileSync(here(name), sb3);
  for (const [sprite, list] of Object.entries(projectScripts(projectJson(sb3))))
    blockText[`${step}:${sprite}`] = list.join("\n\n");
  console.log(`${name}: ${sb3.length} bytes`);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let missing = 0;
const page = readFileSync(here("index.template.html"), "utf8").replace(/<!--blocks:(\d+):(\w+)-->/g, (_, step, sprite) => {
  const text = blockText[`${step}:${sprite}`];
  if (!text) { missing++; console.error(`no scripts for step ${step}, sprite ${sprite}`); return ""; }
  return `<pre class="blocks">${esc(text)}</pre>`;
});
writeFileSync(here("index.html"), page);
writeFileSync(here("blocks.json"), JSON.stringify(blockText, null, 1));
console.log(`index.html written${missing ? `, ${missing} placeholders missing` : ""}`);
if (missing) process.exit(1);
