// Builds the checkpoint files for the Dust Hopper tutorial.
//   starter.sb3  artwork only, no code
//   step1.sb3    end of step 1: sprites placed on the Stage
//   step2.sb3    end of step 2: the drone falls under gravity and stops on the ground
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { writeFileSync } from "node:fs";
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art } from "../../games/dust-hopper/art.ts";

type Step = 0 | 1 | 2;

function checkpoint(step: Step): Buffer {
  const P = new Project();
  const A = art(P);
  const ground = new Blocks(P), pads = new Blocks(P), drone = new Blocks(P);

  if (step >= 1) {
    // Step 1: put every sprite in its starting place when the green flag is clicked.
    for (const B of [ground, pads]) {
      const d = dsl(B);
      B.script(d.whenFlag(), [d.goto(0, 0)]);
    }
  }
  const d = dsl(drone);
  if (step === 1) {
    drone.script(d.whenFlag(), [d.goto(-60, 150), d.point(90)]);
  }
  if (step >= 2) {
    // Step 2: gravity. Speed (vy) changes a little every frame; position changes by the speed.
    const { v, set, change, sub, mul, round, join, or, touching, goto, point, until, sayFor, whenFlag } = d;
    drone.script(whenFlag(), [
      set("gravity", 0.035),
      set("posX", -60),
      set("posY", 150),
      set("vy", 0),
      point(90),
      goto(v("posX"), v("posY")),
      until(or(touching("Ground"), touching("Pads")), [
        change("vy", sub(0, v("gravity"))),
        change("posY", v("vy")),
        goto(v("posX"), v("posY")),
        set("Descent", round(mul(v("vy"), -10))),
      ]),
      sayFor(join("Touchdown! Descent: ", v("Descent")), 2),
    ]);
  }

  return P.build({
    backdrop: A.backdrop,
    sprites: [
      P.sprite("Ground", { blocks: ground, costumes: A.ground, layer: 1 }),
      P.sprite("Pads", { blocks: pads, costumes: A.pads, layer: 2 }),
      P.sprite("Drone", { blocks: drone, costumes: A.drone, layer: 3, x: -60, y: 150 }),
    ],
    shown: step >= 2 ? ["Descent"] : [],
  });
}

const names: Record<Step, string> = { 0: "starter.sb3", 1: "step1.sb3", 2: "step2.sb3" };
for (const step of [0, 1, 2] as Step[]) {
  const sb3 = checkpoint(step);
  writeFileSync(new URL(names[step], import.meta.url), sb3);
  console.log(`${names[step]}: ${sb3.length} bytes`);
}
