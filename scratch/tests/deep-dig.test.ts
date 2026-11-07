// Tests for Deep Dig.
import { test } from "../workbench/testing.ts";

const GAME = "games/deep-dig/deep-dig.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user-MyTemporaryJunk/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;

test("deep dig: a level starts with walls around, the miner top left and a ladder in the bottom row", async t => {
  await t.load(GAME); await t.greenFlag();
  const v = await t.until(v => v.phase === "play", { max: 30, what: "the level to start" });
  const w = v.world as number[];
  t.expect(w.length === 150, `world has ${w.length} squares`);
  t.expect(w.slice(0, 15).every(x => Number(x) === 3) && w.slice(135).every(x => Number(x) === 3), "no wall at the top or bottom");
  t.expect(w.slice(120, 135).filter(x => Number(x) === 8).length === 1, "no ladder in the bottom row");
  await t.frames(10);
  await t.screenshot(shot("deep-dig-start"));
});

// A test mine: walls around, `fill` inside, and the given squares ("col,row": code). The miner stands at (mx, my).
const E = 0, DIRT = 1, ROCK = 2, GOLD = 4, LADDER = 8;
async function mine(t: any, fill: number, squares: Record<string, number>, mx = 1, my = 1) {
  await t.load(GAME); await t.greenFlag();
  await t.until((v: any) => v.phase === "play", { max: 30 });
  const w: number[] = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 15; c++)
    w.push(r === 0 || r === 9 || c === 0 || c === 14 ? 3 : squares[`${c},${r}`] ?? fill);
  w[my * 15 + mx] = E;
  await t.set("world", w); await t.set("falling", Array(150).fill(0));
  await t.set("mx", mx); await t.set("my", my);
}
const at = (v: any, c: number, r: number) => Number(v.world[r * 15 + c]);

test("deep dig: holding right digs a tunnel through dirt", async t => {
  await mine(t, DIRT, {});
  await t.hold("right arrow"); await t.frames(30); await t.release("right arrow");
  const v = await t.vars();
  t.expect(Number(v.mx) >= 5, `mx ${v.mx}`);
  t.expect(at(v, 2, 1) === E && at(v, 4, 1) === E, "the tunnel is not empty");
});

test("deep dig: digging into gold collects it", async t => {
  await mine(t, DIRT, { "2,1": GOLD });
  await t.hold("right arrow"); await t.frames(3); await t.release("right arrow");
  const v = await t.vars();
  t.expect(Number(v.score) === 10 && at(v, 2, 1) === E, `score ${v.score}`);
});

test("deep dig: a rock falls into an empty square below it, one square per turn", async t => {
  await mine(t, DIRT, { "5,2": ROCK, "5,3": E, "5,4": E });
  await t.frames(14);
  const v = await t.vars();
  t.expect(at(v, 5, 4) === ROCK && at(v, 5, 2) === E, `column: ${at(v, 5, 2)} ${at(v, 5, 3)} ${at(v, 5, 4)}`);
});

test("deep dig: a falling rock that lands on the miner costs a life", async t => {
  await mine(t, DIRT, { "3,1": ROCK, "3,2": E, "3,3": E }, 3, 4);
  const v = await t.until(v => v.phase === "ouch", { max: 40, what: "the rock to hit the miner" });
  t.expect(Number(v.lives) === 2, `lives ${v.lives}`);
});

test("deep dig: a rock resting on the miner's head is harmless", async t => {
  await mine(t, DIRT, { "3,1": ROCK }, 3, 2);
  await t.frames(30);
  const v = await t.vars();
  t.expect(v.phase === "play" && Number(v.lives) === 3, `phase ${v.phase}, lives ${v.lives}`);
});

test("deep dig: a rock on top of another rock rolls off to a free side", async t => {
  await mine(t, DIRT, { "6,3": ROCK, "6,4": ROCK, "5,3": E, "5,4": E, "5,5": E });
  await t.frames(20);
  const v = await t.vars();
  t.expect(at(v, 6, 3) === E && at(v, 5, 5) === ROCK, `rock not rolled: ${at(v, 6, 3)} ${at(v, 5, 4)} ${at(v, 5, 5)}`);
});

test("deep dig: the miner pushes a rock sideways into an empty square", async t => {
  await mine(t, DIRT, { "2,1": ROCK, "3,1": E });
  await t.hold("right arrow"); await t.frames(3); await t.release("right arrow");
  const v = await t.vars();
  t.expect(at(v, 3, 1) === ROCK && Number(v.mx) === 2, `mx ${v.mx}, square ${at(v, 3, 1)}`);
});

test("deep dig: the ladder leads one level deeper", async t => {
  await mine(t, DIRT, { "2,1": LADDER });
  await t.hold("right arrow"); await t.frames(3); await t.release("right arrow");
  const v = await t.vars();
  t.expect(Number(v.level) === 2 && Number(v.depth) === 50, `level ${v.level}, depth ${v.depth}`);
});

test("deep dig: a short play session (picture)", async t => {
  await t.load(GAME); await t.greenFlag();
  await t.until(v => v.phase === "play", { max: 30 });
  for (const [k, n] of [["down arrow", 20], ["right arrow", 25], ["down arrow", 10], ["right arrow", 15]] as const) {
    await t.hold(k); await t.frames(n); await t.release(k);
  }
  await t.frames(8);
  await t.screenshot(shot("deep-dig-play"));
  t.log(await t.vars().then(v => ({ score: v.score, lives: v.lives, phase: v.phase })));
});
