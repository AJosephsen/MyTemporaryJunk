// Tests for the Comet Rally tutorial checkpoints.
import { test, type T } from "../workbench/testing.ts";

const STEP = (n: number) => `tutorials/comet-rally/step${n}.sb3`;

async function start(t: T, step: number) {
  await t.load(STEP(step));
  await t.greenFlag();
  await t.frames(1);
}

// Sends the ball at the player's paddle from the right, at the given height, and returns its new direction.
async function hitPlayer(t: T, step: number, paddleY: number, ballY: number) {
  await start(t, step);
  await t.mouse(0, paddleY);
  await t.frames(1);
  await t.place("Ball", -180, ballY, -90);
  await t.until((v, w) => w.sprite("Ball").direction > 0, { max: 10, what: "the ball to bounce off the paddle" });
  return t.sprite("Ball");
}

test("comet rally step 1: the paddle follows the mouse up and down", async t => {
  await start(t, 1);
  await t.mouse(0, 100);
  await t.frames(1);
  t.near((await t.sprite("Player")).y, 100, 0.5, "paddle y");
  await t.mouse(0, -60);
  await t.frames(1);
  t.near((await t.sprite("Player")).y, -60, 0.5, "paddle y");
});

test("comet rally step 2: the ball moves and bounces off the edges", async t => {
  await start(t, 2);
  const a = await t.sprite("Ball");
  await t.frames(60);
  const b = await t.sprite("Ball");
  t.expect(b.direction !== a.direction, `direction after 2 s: ${b.direction}`);
  t.expect(Math.abs(b.x) <= 240 && Math.abs(b.y) <= 180, "ball still on the Stage");
});

for (const [offset, expected, what] of [[0, 90, "straight across"], [20, 66, "upwards"], [-20, 114, "downwards"]] as const) {
  test(`comet rally step 3: hitting ${offset} px from the paddle's middle sends the ball ${what}`, async t => {
    const ball = await hitPlayer(t, 3, 0, offset);
    t.near(ball.direction, expected, 0.01, "direction after the hit (90 - offset × 1.2)");
  });
}

test("comet rally step 4: the robot follows the ball, a little slowly", async t => {
  await start(t, 4);
  await t.place("Ball", 0, 100, 90);      // flying straight across at y = 100
  await t.frames(10);
  const robot = await t.sprite("Robot");
  t.expect(robot.y > 50 && robot.y < 100, `robot y after 10 frames: ${robot.y}`);
});

test("comet rally step 4: the robot's paddle sends the ball back with aim", async t => {
  await start(t, 4);
  await t.frames(40);                       // let the robot settle near y = 0
  await t.place("Robot", 210, 0);
  await t.place("Ball", 180, 20, 90);
  await t.until((v, w) => w.sprite("Ball").direction < 0, { max: 10, what: "the ball to bounce off the robot" });
  const d = (await t.sprite("Ball")).direction;
  t.expect(d < -60 && d > -90, `direction after hitting the robot above its middle: ${d}`);
});

test("comet rally step 5: a missed ball scores for the robot and is served again", async t => {
  await start(t, 5);
  await t.mouse(0, 150);
  await t.place("Ball", -150, -100, -90);
  await t.until(v => v["Robot score"] === 1, { max: 60 });
  const ball = await t.sprite("Ball");
  t.expect(ball.x === 0 && ball.y === 0, `ball served from the middle: ${ball.x}, ${ball.y}`);
  t.expect(ball.direction <= -60 && ball.direction >= -120, `served towards the player: ${ball.direction}`);
  t.expect((await t.get("Your score")) === 0, "player score unchanged");
});

test("comet rally step 6: every hit makes the ball faster", async t => {
  await hitPlayer(t, 6, 0, 10);
  t.near(await t.get("speed"), 6.5, 1e-9, "speed after one hit");
});

test("comet rally step 6: a player who aims beats the robot", async t => {
  await start(t, 6);
  // Hit the ball with the lower part of the paddle, so it always flies off at an angle.
  const v = await t.until((v, w) => {
    w.mouse(0, w.sprite("Ball").y - 25);
    return v["Your score"] === 5 || v["Robot score"] === 5;
  }, { max: 30 * 240, what: "someone to reach 5 points" });
  t.log(v["Your score"], ":", v["Robot score"]);
  t.expect(v["Your score"] === 5, `final score ${v["Your score"]} : ${v["Robot score"]}`);
  t.expect((await t.sprite("Ball")).bubble === "You win!", "winner message");
});

test("comet rally step 6: a player who never moves loses", async t => {
  await start(t, 6);
  await t.mouse(0, 170);
  const v = await t.until(v => v["Robot score"] === 5, { max: 30 * 120 });
  t.expect(v["Your score"] < 2, `your score ${v["Your score"]}`);
  t.expect((await t.sprite("Ball")).bubble === "The robot wins!", "winner message");
});

test("comet rally: every checkpoint runs for 3 seconds without errors", async t => {
  for (const path of ["tutorials/comet-rally/starter.sb3", ...[1, 2, 3, 4, 5, 6].map(STEP)]) {
    await t.load(path);
    await t.greenFlag();
    await t.frames(90);
  }
});
