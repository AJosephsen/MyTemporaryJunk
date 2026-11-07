// Tests for Dust Hopper: the finished game and the tutorial checkpoints.
import { test, type T, type Vars } from "../workbench/testing.ts";

const GAME = "games/dust-hopper/dust-hopper.sb3";
const STEP = (n: number) => `tutorials/dust-hopper/step${n}.sb3`;

async function startRound(t: T, path: string) {
  await t.load(path);
  await t.greenFlag();
  return t.until(v => v.state === "flying", { max: 400, what: "the first round to start" });
}

// Flies straight down over the given x, using the arrow keys like a player: more throttle when falling
// fast, less when falling slowly. The steering runs inside the page, one decision per frame.
// Returns the variables at touchdown.
async function autopilot(t: T, x: number): Promise<Vars> {
  await t.set("posX", x);
  await t.set("vx", 0);
  return t.until((v, w, memo) => {
    if (v.state === "flying") w.fuelBeforeTouchdown = v.fuelLeft;
    const want = v.state !== "flying" ? "" : v.Descent > 6 ? "up arrow" : v.Descent < 3 ? "down arrow" : "";
    if (want !== (memo.held ?? "")) {
      if (memo.held) w.key(memo.held, false);
      if (want) w.key(want, true);
      memo.held = want;
    }
    return v.state !== "flying";
  }, { max: 1500, what: "touchdown" });
}

// ---------------------------------------------------------------- physics and timing
test("tutorial step 2: the tick runs once per frame and free fall matches the table", async t => {
  await startRound(t, STEP(2));
  const k = (v: Vars) => Math.round(-v.vy / 0.035);       // ticks of gravity so far
  const before = k(await t.vars());
  await t.frames(90);
  const v = await t.vars();
  t.expect(k(v) - before === 90, `expected 90 gravity ticks in 90 frames, got ${k(v) - before}`);
  t.near(v.posY, 150 - 0.035 * k(v) * (k(v) + 1) / 2, 1e-6, "posY");
  if (before === 0) t.near(v.posY, 6.675, 1e-6, "posY after 90 frames (tutorial table: 6.7)");
});

test("tutorial step 2: touchdown on the rocks at Descent about 38", async t => {
  await startRound(t, STEP(2));
  const v = await t.until(v => v.state === "landed", { max: 300 });
  t.near(v.Descent, 38, 2, "Descent at touchdown");
  t.expect((await t.sprite("Drone")).bubble === `Touchdown! Descent: ${v.Descent}`, "touchdown message");
});

test("tutorial step 3: holding Up raises the throttle one step every 4 frames", async t => {
  await startRound(t, STEP(3));
  await t.hold("up arrow");
  await t.frames(30);
  await t.release("up arrow");
  t.expect((await t.get("Throttle")) === 8, `Throttle after one second: ${await t.get("Throttle")}`);
});

test("tutorial step 4: tilting right turns the drone 11.25 degrees per tap", async t => {
  await startRound(t, STEP(4));
  await t.hold("right arrow");
  await t.frames(1);
  await t.release("right arrow");
  await t.frames(4);
  t.near((await t.sprite("Drone")).direction, 101.25, 1e-9, "direction");
  t.near(await t.get("angle"), 11.25, 1e-9, "angle");
});

test("tutorial step 5: the drone wraps from the right edge to the left", async t => {
  await startRound(t, STEP(5));
  await t.set("gravity", 0);
  await t.set("posX", 220);
  await t.set("vx", 4);
  await t.frames(4);
  const v = await t.vars();
  t.expect(v.posX < -200, `posX after crossing the right edge: ${v.posX}`);
  t.near((await t.sprite("Drone")).x, v.posX, 1, "sprite follows posX");
});

// ---------------------------------------------------------------- landing rules
test("tutorial step 6: gentle touchdown on the x2 pad is a perfect landing", async t => {
  await startRound(t, STEP(6));
  const v = await autopilot(t, -115);
  t.expect(v.state === "good", `state ${v.state} at Descent ${v.Descent}`);
  t.expect(v.mult === 2, `mult ${v.mult}`);
  await t.frames(2);
  t.expect((await t.sprite("Drone")).bubble === "Perfect landing! x2", "result message");
});

test("tutorial step 6: falling onto a pad without throttle is a crash", async t => {
  await startRound(t, STEP(6));
  await t.set("posX", -115);
  await t.set("vx", 0);
  const v = await t.until(v => v.state !== "flying", { max: 400 });
  t.expect(v.state === "crash", `state ${v.state} at Descent ${v.Descent}`);
  await t.frames(2);
  t.expect((await t.sprite("Drone")).costume === "boom", "boom costume");
});

for (const [label, path] of [["tutorial step 7", STEP(7)], ["game", GAME]]) {
  test(`${label}: perfect landing on x2 scores 100 and adds 50 fuel, then a new round starts`, async t => {
    await startRound(t, path);
    const v = await autopilot(t, -115);
    t.expect(v.state === "good", `state ${v.state} at Descent ${v.Descent}`);
    // The result is handled in the touchdown frame, so compare with the last frame in flight.
    const before = await t.page(w => w.fuelBeforeTouchdown as number);
    t.expect(v.Score === 100, `Score ${v.Score}`);
    t.near(v.fuelLeft - before, 50, 2, "fuel bonus (minus at most one frame of burn)");
    await t.until(v => v.state === "flying", { max: 90, what: "the next round" });
  });
}

test("game: a crash costs 150 fuel and the next round starts", async t => {
  await startRound(t, GAME);
  const crash = await t.until(v => v.state !== "flying", { max: 400 });
  t.expect(crash.state === "crash", `state ${crash.state}`);
  t.expect((await t.sprite("Drone")).bubble === "Crashed! -150 fuel", "crash message");
  const next = await t.until(v => v.state === "flying", { max: 90, what: "the next round" });
  t.near(next.fuelLeft, 850, 0.001, "fuel in the next round (1000, no throttle used, minus 150)");
});

test("game: game over when the fuel runs out", async t => {
  await startRound(t, GAME);
  await t.set("fuelLeft", 100);
  await t.until(v => v.state === "crash", { max: 400 });
  await t.frames(70);
  t.expect((await t.sprite("Drone")).bubble === "Out of fuel. Final score: 0", `message: ${(await t.sprite("Drone")).bubble}`);
  t.expect((await t.get("Fuel")) === 0, "Fuel display");
});

test("game: setup shows the instructions before the first round", async t => {
  await t.load(GAME);
  await t.greenFlag();
  await t.frames(2);
  t.expect((await t.sprite("Drone")).bubble.startsWith("Up/Down: throttle"), "instructions shown");
  t.expect((await t.get("state")) === "waiting", "not flying during setup");
});

// ---------------------------------------------------------------- every checkpoint runs
test("every tutorial checkpoint runs for 3 seconds without errors", async t => {
  for (const path of ["tutorials/dust-hopper/starter.sb3", ...[1, 2, 3, 4, 5, 6, 7, 8].map(STEP)]) {
    await t.load(path);
    await t.greenFlag();
    await t.frames(90);
  }
});
