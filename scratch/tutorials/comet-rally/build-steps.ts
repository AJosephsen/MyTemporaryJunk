// Builds the Comet Rally tutorial: a two-paddle rally game for young Scratchers, the player against a robot.
//   starter.sb3   artwork only, no code
//   stepN.sb3     the project at the end of step N (1-6)
// Kept simple on purpose: every sprite has one classic forever loop, and the only maths is the aim:
// where the ball hits a paddle decides its new direction.
// Run: node --experimental-strip-types --no-warnings build-steps.ts
import { Project, Blocks, dsl } from "../../lib/sb3.ts";
import { art } from "../../games/comet-rally/art.ts";
import { buildTutorial } from "../../lib/tutorial.ts";

const LAST = 6;
export const AIM = 1.2;   // degrees of turn per pixel away from the paddle's middle

function scripts(step: number, player: Blocks, robot: Blocks, ball: Blocks) {
  const at = (n: number) => step >= n;
  const when = <T>(n: number, xs: () => T[]): T[] => (at(n) ? xs() : []);

  // ---------------------------------------------------------------- Player: follows the mouse
  {
    const { whenFlag, goto, forever, setY, mouseY, ifThen, gt, lt, yPos } = dsl(player);
    player.script(whenFlag(), [
      goto(-210, 0),
      forever([
        setY(mouseY()),
        ...when(6, () => [
          ifThen(gt(yPos(), 140), [setY(140)]),
          ifThen(lt(yPos(), -140), [setY(-140)]),
        ]),
      ]),
    ]);
  }

  // ---------------------------------------------------------------- Robot: follows the ball, a little slowly
  if (at(4)) {
    const { whenFlag, goto, forever, changeY, div, sub, of, yPos } = dsl(robot);
    robot.script(whenFlag(), [
      goto(210, 0),
      forever([changeY(div(sub(of("y position", "Ball"), yPos()), 10))]),
    ]);
  }

  // ---------------------------------------------------------------- Ball
  if (!at(2)) return;
  const { v, add, sub, mul, lt, gt, eq, and, set, change, whenFlag, goto, point, forever, move, bounceOnEdge,
    ifThen, touching, direction, yPos, xPos, of, random, wait, say, stopThis, changeEffect } = dsl(ball);

  // The aim: hitting the middle of a paddle sends the ball straight across,
  // hitting near the top sends it up, near the bottom sends it down.
  const hit = (paddle: string, base: number, sign: number) => [
    point((sign < 0 ? sub : add)(base, mul(sub(yPos(), of("y position", paddle)), AIM))),
    ...when(6, () => [change("speed", 0.5), changeEffect("COLOR", 25)]),
  ];
  const serve = (from: number, to: number) => [
    goto(0, 0),
    point(random(from, to)),
    ...when(6, () => [set("speed", 6)]),
    wait(1),
  ];

  ball.script(whenFlag(), [
    ...when(5, () => [set("Your score", 0), set("Robot score", 0)]),
    ...when(6, () => [set("speed", 6)]),
    goto(0, 0),
    point(45),
    forever([
      move(at(6) ? v("speed") : 6),
      ...when(3, () => [ifThen(and(touching("Player"), lt(direction(), 0)), hit("Player", 90, -1))]),
      ...when(4, () => [ifThen(and(touching("Robot"), gt(direction(), 0)), hit("Robot", -90, 1))]),
      ...when(5, () => [
        ifThen(lt(xPos(), -220), [
          change("Robot score", 1),
          ...when(6, () => [ifThen(eq(v("Robot score"), 5), [say("The robot wins!"), stopThis()])]),
          ...serve(-120, -60),
        ]),
        ifThen(gt(xPos(), 220), [
          change("Your score", 1),
          ...when(6, () => [ifThen(eq(v("Your score"), 5), [say("You win!"), stopThis()])]),
          ...serve(60, 120),
        ]),
      ]),
      bounceOnEdge(),
    ]),
  ]);
}

function checkpoint(step: number): Buffer {
  const P = new Project();
  const A = art(P);
  const player = new Blocks(P), robot = new Blocks(P), ball = new Blocks(P);
  if (step >= 1) scripts(step, player, robot, ball);
  return P.build({
    backdrop: A.backdrop,
    sprites: [
      P.sprite("Player", { blocks: player, costumes: A.player, layer: 1, x: -210, y: 0 }),
      P.sprite("Robot", { blocks: robot, costumes: A.robot, layer: 2, x: 210, y: 0 }),
      P.sprite("Ball", { blocks: ball, costumes: A.ball, layer: 3, x: 0, y: 0 }),
    ],
    shown: step >= 5 ? ["Your score", "Robot score"] : [],
    shownLeft: 1,
  });
}

buildTutorial(new URL(".", import.meta.url), LAST, checkpoint, ["Stage", "Player", "Robot", "Ball"]);
