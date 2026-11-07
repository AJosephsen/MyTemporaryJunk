// Tests for Dust Hopper: the finished game and the tutorial checkpoints.
import { test, type T, type Vars } from "../workbench/testing.ts";

const GAME = "games/dust-hopper/dust-hopper.sb3";
const STEP = (n: number) => `tutorials/dust-hopper/step${n}.sb3`;

async function startRound(t: T, path: string) {
  await t.load(path);
  await t.greenFlag();
  return t.until(v => v.state === "flying", { max: 400, what: "the first round to start" });
}

// Flies straight down over the given x, using the keys like a player. The steering runs inside the page,
// one decision per frame. Returns the variables at touchdown.
//   "throttle" (tutorial): more throttle when falling fast, less when falling slowly.
//   "burst" (game): hold Up while falling too fast, otherwise let gravity work.
async function autopilot(t: T, x: number, style: "throttle" | "burst"): Promise<Vars> {
  await t.set("posX", x);
  await t.set("vx", 0);
  return t.until((v, w, memo) => {
    if (v.state === "flying") w.fuelBeforeTouchdown = v.fuelLeft;
    const burst = !("Throttle" in v);
    const want = v.state !== "flying" ? "" : burst ? (v.Descent > 5 ? "up arrow" : "")
      : v.Descent > 6 ? "up arrow" : v.Descent < 3 ? "down arrow" : "";
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
  const v = await autopilot(t, -115, "throttle");
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
    const v = await autopilot(t, -115, path === GAME ? "burst" : "throttle");
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
  t.expect((await t.sprite("Drone")).bubble.startsWith("Up: thrust"), "instructions shown");
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

// ---------------------------------------------------------------- game controls
test("game: holding Up thrusts (1 fuel per frame); releasing lets gravity pull the drone down", async t => {
  const start = await startRound(t, GAME);
  await t.set("posY", 0);       // room to climb below the ceiling
  await t.set("vy", 0);
  await t.hold("up arrow");
  await t.frames(30);
  const up = await t.vars();
  await t.release("up arrow");
  await t.frames(30);
  const down = await t.vars();
  t.expect(up.vy > 0, `climbing after 1 s of thrust: vy ${up.vy}`);
  t.near(start.fuelLeft - up.fuelLeft, 30, 1, "fuel used by 30 frames of thrust");
  t.expect(down.vy < up.vy - 0.9, `falling again after release: vy ${down.vy}`);
  t.expect(down.fuelLeft === up.fuelLeft, "no fuel used without thrust");
});

test("game: Space gives one boost kick per press, costs 30 fuel and recharges in 1 second", async t => {
  await startRound(t, GAME);
  await t.set("vx", 0);
  await t.set("vy", 0);
  const before = await t.vars();
  await t.hold("space");
  await t.frames(1);
  const kicked = await t.vars();
  t.near(kicked.vy, 2 - 0.035, 1e-6, "vy after one kick (2 up, minus one frame of gravity)");
  t.near(before.fuelLeft - kicked.fuelLeft, 30, 1e-6, "fuel per kick");
  t.expect((await t.sprite("Drone")).costume === "drone-boost", "big flame during the kick");
  await t.frames(40);                       // keep holding: no second kick
  t.expect((await t.get("fuelLeft")) === kicked.fuelLeft, "holding Space gives only one kick");
  await t.release("space");
  await t.frames(1);
  await t.hold("space");
  await t.frames(1);
  t.near(kicked.fuelLeft - (await t.get("fuelLeft")), 30, 1e-6, "a new press after the recharge kicks again");
  await t.release("space");
  await t.frames(1);
  await t.hold("space");
  await t.frames(1);
  t.near(kicked.fuelLeft - (await t.get("fuelLeft")), 30, 1e-6, "a press during the recharge does nothing");
});

// ---------------------------------------------------------------- particles (game only)
const particleCount = (t: T) => t.page(w => w.vm.runtime.targets.filter((x: any) => x.sprite.name === "Particle" && !x.isOriginal).length as number);

test("game: the engine makes fire and smoke while thrusting, and they fade away", async t => {
  await startRound(t, GAME);
  t.expect((await particleCount(t)) === 0, "no particles before thrust");
  await t.hold("up arrow");
  await t.frames(40);
  const thrusting = await particleCount(t);
  await t.release("up arrow");
  await t.set("gravity", 0);   // hover, so the drone doesn't crash while the particles fade
  await t.set("vy", 0);
  await t.frames(80);
  const later = await particleCount(t);
  t.log({ thrusting, later });
  t.expect(thrusting >= 10, `particles while thrusting: ${thrusting}`);
  t.expect(later === 0, `particles left 80 frames after the engine stopped: ${later}`);
});

test("game: thrust plus repeated boost kicks stay well below the 300-clone limit", async t => {
  await startRound(t, GAME);
  await t.hold("up arrow");
  let most = 0;
  for (let i = 0; i < 6; i++) {
    await t.hold("space"); await t.frames(2); await t.release("space");
    for (let j = 0; j < 3; j++) { await t.frames(10); most = Math.max(most, await particleCount(t)); }
  }
  await t.release("up arrow");
  t.log({ most });
  t.expect(most > 20 && most < 150, `most particles at once: ${most}`);
});

test("game: a crash makes an explosion, cleared when the next round starts", async t => {
  await startRound(t, GAME);
  await t.until(v => v.state === "crash", { max: 400 });
  await t.frames(2);
  const burst = await particleCount(t);
  await t.until(v => v.state === "flying", { max: 90, what: "the next round" });
  await t.frames(1);
  const after = await particleCount(t);
  t.log({ burst, after });
  t.expect(burst >= 25, `explosion particles: ${burst}`);
  t.expect(after === 0, `particles in the new round: ${after}`);
});
