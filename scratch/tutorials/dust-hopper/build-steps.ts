// Builds the Dust Hopper tutorial: one checkpoint .sb3 per step, and index.html from index.template.html.
//   starter.sb3   artwork only, no code
//   stepN.sb3     the project as it should be at the end of step N (1-8)
//
// The game has no game loop. The Stage broadcasts [tick] once per frame, and the game moves through
// phases, each a broadcast: setup, new round, tick, round over, game over. The drone's per-frame work
// is split into custom blocks (My Blocks).
//
// Block pictures in the page are generated from the same checkpoints, so page and files always match.
// In the template, <!--changed:N--> becomes every script that is new or changed in step N,
// compared with step N-1, grouped by sprite.
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { readFileSync, writeFileSync } from "node:fs";
import { Project, Blocks, dsl, type Ref } from "../../lib/sb3.ts";
import { art, PADS } from "../../games/dust-hopper/art.ts";
import { projectScripts } from "../../tools/scratchblocks/to-scratchblocks.ts";

const LAST = 8;
const INSTRUCTIONS = "Up/Down: throttle. Left/Right: tilt. Space: boost. Land gently on a yellow pad!";

function scripts(step: number, stage: Blocks, ground: Blocks, pads: Blocks, drone: Blocks) {
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Stage: the clock and the game totals
  {
    const { set, whenFlag, whenReceive, broadcast, broadcastWait, forever } = dsl(stage);
    stage.script(whenFlag(), [
      broadcastWait("setup"),
      ...when(2, () => [broadcast("new round"), forever([broadcast("tick")])]),
    ]);
    if (at(2)) stage.script(whenReceive("setup"), [
      set("gravity", 0.035),
      ...when(7, () => [set("Score", 0), set("fuelLeft", 1000), set("Fuel", 1000)]),
      ...when(8, () => [set("Throttle", 0), set("Drift", 0), set("Descent", 0)]),
      set("state", "waiting"),
    ]);
  }

  // ---------------------------------------------------------------- Ground and Pads
  {
    const d = dsl(ground);
    ground.script(d.whenReceive("setup"), [d.goto(0, 0)]);
  }
  {
    const d = dsl(pads);
    pads.script(d.whenReceive("setup"), [
      d.goto(0, 0),
      ...when(6, () => [
        d.deleteAll("padLeft"), d.deleteAll("padRight"), d.deleteAll("padMult"),
        ...PADS.flatMap(p => [d.addTo("padLeft", p.l), d.addTo("padRight", p.r), d.addTo("padMult", p.mult)]),
      ]),
    ]);
  }

  // ---------------------------------------------------------------- Drone
  const { v, sub, mul, lt, gt, eq, and, or, not, sin, cos, abs, round, join, item, length, set, change,
    key, touching, direction, goto, point, turn, turnLeft, costume, show, front, say, sayFor, broadcast,
    whenReceive, ifThen, ifElse, repeat, define, call } = dsl(drone);

  drone.script(whenReceive("setup"), [
    goto(-60, 150), point(90),
    ...when(8, () => [costume("drone"), show(), front(), sayFor(INSTRUCTIONS, 4)]),
  ]);
  if (!at(2)) return;

  drone.script(whenReceive("new round"), [
    set("posX", -60), set("posY", 150),
    ...when(4, () => [set("vx", 1.2)]),
    set("vy", 0),
    ...when(3, () => [set("Throttle", 0), set("cooldown", 0)]),
    point(90),
    ...when(6, () => [costume("drone"), show()]),
    goto(v("posX"), v("posY")),
    set("state", "flying"),
  ]);

  // The per-frame work, in a fixed order.
  const work: string[] = [
    ...when(3, () => ["read controls", "run engine"]),
    "move", "place on screen", "update displays", "check touchdown",
    ...when(8, () => ["show flame"]),
  ];
  drone.script(whenReceive("tick"), [ifThen(eq(v("state"), "flying"), work.map(call))]);

  if (at(6)) drone.script(whenReceive("round over"), [
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
    ...(at(7)
      ? [set("Fuel", round(v("fuelLeft"))), ifElse(gt(v("fuelLeft"), 0), [broadcast("new round")], [broadcast("game over")])]
      : [broadcast("new round")]),
  ]);
  if (at(7)) drone.script(whenReceive("game over"), [say(join("Out of fuel. Final score: ", v("Score")))]);

  // ---- custom blocks
  if (at(3)) define("read controls", [
    ifElse(gt(v("cooldown"), 0), [change("cooldown", -1)], [
      ifThen(and(key("up arrow"), lt(v("Throttle"), 15)), [change("Throttle", 1), set("cooldown", 3)]),
      ifThen(and(key("down arrow"), gt(v("Throttle"), 0)), [change("Throttle", -1), set("cooldown", 3)]),
      ...when(4, () => [
        ifThen(key("right arrow"), [turn(11.25), set("cooldown", 4)]),
        ifThen(key("left arrow"), [turnLeft(11.25), set("cooldown", 4)]),
      ]),
    ]),
  ]);

  if (at(3)) define("run engine", [
    set("force", mul(v("Throttle"), 0.004)),
    ...when(8, () => [ifThen(key("space"), [set("force", 0.07)])]),
    ...when(7, () => [
      ifThen(lt(v("fuelLeft"), 0.01), [set("force", 0)]),
      change("fuelLeft", sub(0, mul(v("force"), 25))),
      ifThen(lt(v("fuelLeft"), 0), [set("fuelLeft", 0)]),
    ]),
  ]);

  define("move", at(4) ? [
    set("angle", sub(direction(), 90)),
    ifThen(lt(v("angle"), -180), [change("angle", 360)]),
    change("vx", mul(v("force"), sin(v("angle")))),
    change("vy", sub(mul(v("force"), cos(v("angle"))), v("gravity"))),
    change("posX", v("vx")),
    change("posY", v("vy")),
  ] : [
    change("vy", sub(at(3) ? v("force") : 0, v("gravity"))),
    change("posY", v("vy")),
  ]);

  define("place on screen", [
    ...when(5, () => [
      ifThen(gt(v("posX"), 230), [change("posX", -460)]),
      ifThen(lt(v("posX"), -230), [change("posX", 460)]),
      ifThen(gt(v("posY"), 165), [set("posY", 165), ifThen(gt(v("vy"), 0), [set("vy", 0)])]),
    ]),
    goto(v("posX"), v("posY")),
  ]);

  define("update displays", [
    ...when(7, () => [set("Fuel", round(v("fuelLeft")))]),
    ...when(4, () => [set("Drift", round(mul(v("vx"), 10)))]),
    set("Descent", round(mul(v("vy"), -10))),
  ]);

  define("check touchdown", at(6) ? [
    ...when(8, () => [costume("drone")]),
    ifElse(touching("Pads"), [call("judge landing")], [ifThen(touching("Ground"), [set("state", "crash")])]),
    ifThen(not(eq(v("state"), "flying")), [broadcast("round over")]),
  ] : [
    ifThen(or(touching("Ground"), touching("Pads")), [
      set("state", "landed"),
      say(join("Touchdown! Descent: ", v("Descent"))),
    ]),
  ]);

  if (at(6)) define("judge landing", [
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
  ], { warp: true });

  if (at(8)) define("show flame", [
    ifThen(and(eq(v("state"), "flying"), gt(v("force"), 0)),
      [ifElse(lt(v("force"), 0.04), [costume("drone-flame")], [costume("drone-boost")])]),
  ]);
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
  const stage = new Blocks(P), ground = new Blocks(P), pads = new Blocks(P), drone = new Blocks(P);
  if (step >= 1) scripts(step, stage, ground, pads, drone);
  return P.build({
    backdrop: A.backdrop,
    stage,
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

// ---------------------------------------------------------------- build checkpoints
type Scripts = Record<string, Map<string, string>>; // sprite -> (first line -> script text)
const here = (f: string) => new URL(f, import.meta.url);
const perStep: Scripts[] = [];
for (let step = 0; step <= LAST; step++) {
  const sb3 = checkpoint(step);
  const name = step === 0 ? "starter.sb3" : `step${step}.sb3`;
  writeFileSync(here(name), sb3);
  const byTarget: Scripts = {};
  for (const [target, list] of Object.entries(projectScripts(projectJson(sb3))))
    byTarget[target] = new Map(list.map(s => [s.split("\n")[0], s]));
  perStep.push(byTarget);
  console.log(`${name}: ${sb3.length} bytes`);
}

// ---------------------------------------------------------------- page
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TARGETS = ["Stage", "Ground", "Pads", "Drone"];

function changed(step: number): string {
  const now = perStep[step], before = perStep[step - 1];
  const panels: string[] = [], removed: string[] = [];
  for (const t of TARGETS) {
    for (const [head, text] of now[t] ?? new Map()) {
      const old = before[t]?.get(head);
      if (old === text) continue;
      const tag = old === undefined ? "new" : "changed";
      panels.push(`<div class="blocks-panel"><div class="label">${t} <span class="tag ${tag}">${tag}</span></div>\n<pre class="blocks">${esc(text)}</pre></div>`);
    }
    for (const head of before[t]?.keys() ?? []) if (!now[t]?.has(head)) removed.push(`${t}: <code>${esc(head)}</code>`);
  }
  const note = removed.length ? `<p class="note"><b>Remove</b> ${removed.join(", ")}.</p>\n` : "";
  return `${note}<div class="scripts">\n${panels.join("\n")}\n</div>`;
}

let missing = 0;
const page = readFileSync(here("index.template.html"), "utf8").replace(/<!--changed:(\d+)-->/g, (_, n) => {
  const step = Number(n);
  if (!perStep[step] || step < 1) { missing++; return ""; }
  return changed(step);
});
writeFileSync(here("index.html"), page);
const blockText: Record<string, string> = {};
perStep.forEach((byTarget, step) => {
  for (const [t, m] of Object.entries(byTarget)) if (m.size) blockText[`${step}:${t}`] = [...m.values()].join("\n\n");
});
writeFileSync(here("blocks.json"), JSON.stringify(blockText, null, 1));
console.log(`index.html written${missing ? `, ${missing} placeholders missing` : ""}`);
if (missing) process.exit(1);
