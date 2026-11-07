// Tests for the Bubble Probe demo: the chain is found in one frame by a probe sprite that touches neighbour slots.
import { test, type T, type Vars } from "../workbench/testing.ts";

const DEMO = "demos/bubble-probe/bubble-probe.sb3";
const idx = (row: number, col: number) => row * 8 + col + 1;
type Ball = { x: number; y: number; color: number };

async function start(t: T, cells: Record<number, number>) {
  await t.load(DEMO);
  const layout = Array(96).fill(0);
  for (const [i, c] of Object.entries(cells)) layout[Number(i) - 1] = c;
  await t.set("layout", layout);
  await t.greenFlag();
  return t.until(v => v.phase === "aim", { max: 60, what: "the demo to start" });
}

const balls = (t: T) => t.page(w => w.vm.runtime.targets
  .filter((x: any) => /^Bubble\d$/.test(x.sprite.name) && !x.isOriginal)
  .map((x: any) => ({ x: Math.round(x.x * 10) / 10, y: Math.round(x.y * 10) / 10, color: Number(x.sprite.name.slice(6)) })) as Ball[]);

async function shoot(t: T, x: number, y: number, color: number): Promise<{ v: Vars; probeMs: number; probeFrames: number }> {
  await t.set("shotColor", color);
  await t.mouse(x, y);
  await t.frames(1);
  await t.hold("space"); await t.frames(1); await t.release("space");
  await t.until(v => v.phase === "probe", { max: 600, what: "the shot to land" });
  // The search runs in the frame the probe is asked; measure how long that frame really took to run.
  let probeFrames = 0, probeMs = 0;
  while ((await t.get("phase")) === "probe" && probeFrames < 600) {
    await t.frames(1); probeFrames++;
    probeMs = Math.max(probeMs, await t.page(w => w.lastStepMs as number));
  }
  const v = await t.until(v => v.phase === "aim", { max: 600, what: "the result to play out" });
  return { v, probeMs, probeFrames };
}

function expected(before: Ball[], landed: Ball): Ball[] {
  const all = [...before, landed];
  const near = (a: Ball, b: Ball) => a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 30;
  const grow = (start: Ball[], ok: (b: Ball) => boolean) => {
    const seen = new Set(start), q = [...start];
    while (q.length) { const a = q.shift()!; for (const b of all) if (!seen.has(b) && ok(b) && near(a, b)) { seen.add(b); q.push(b); } }
    return seen;
  };
  const match = grow([landed], b => b.color === landed.color);
  if (match.size < 3) return all;
  const left = all.filter(b => !match.has(b));
  const anchored = grow(left.filter(b => Math.abs(b.y - 147) < 1), b => !match.has(b));
  return left.filter(b => anchored.has(b));
}
const key = (b: Ball) => `${Math.round(b.x)},${Math.round(b.y)},${b.color}`;

test("bubble probe: three of a colour pop and a hanging bubble falls, found in one frame", async t => {
  await start(t, { [idx(0, 3)]: 2, [idx(1, 3)]: 1, [idx(2, 3)]: 3, [idx(2, 4)]: 1 });
  const { v, probeFrames } = await shoot(t, 0, 100, 1);
  const left = await balls(t);
  t.expect(v.markedCount === 3, `matched ${v.markedCount}`);
  t.expect(v.dropped === 1, `dropped ${v.dropped}`);
  t.expect(left.length === 1 && left[0].color === 2, `left: ${JSON.stringify(left)}`);
  t.expect(probeFrames <= 1, `the search took ${probeFrames} frames`);
});

test("bubble probe: two of a colour stay", async t => {
  await start(t, { [idx(0, 3)]: 2, [idx(0, 0)]: 3 });
  const { v } = await shoot(t, 0, 100, 2);
  t.expect(v.markedCount === 2 && (await balls(t)).length === 3, `matched ${v.markedCount}`);
});

// method: "queue" (breadth-first with a queue), "recursive" (the default) or "slow" (recursion with screen refresh).
async function randomBoards(t: T, method: string) {
  await t.load(DEMO);
  await t.set("method", method);
  await t.set("layout", Array.from({ length: 96 }, (_, i) => {
    const row = Math.floor(i / 8), col = i % 8;
    return row < 5 && !(row % 2 === 1 && col === 7) ? 1 + ((i * 7 + row * 3) % 4) : 0;
  }));
  await t.greenFlag();
  let compared = 0, popped = 0, slowest = 0, maxFrames = 0;
  for (let shot = 0; shot < 25; shot++) {
    await t.until(v => v.phase === "aim", { max: 600 });
    const before = await balls(t);
    if (before.length === 0 || before.some(b => b.y < -90)) break;
    const low = [...before].sort((a, b) => a.y - b.y).slice(0, 6);
    const target = low[(shot * 5) % low.length];
    const { v, probeMs, probeFrames } = await shoot(t, target.x, target.y, target.color);
    slowest = Math.max(slowest, probeMs); maxFrames = Math.max(maxFrames, probeFrames);
    const after = await balls(t);
    const want = expected(before, { x: Math.round(v.newX * 10) / 10, y: Math.round(v.newY * 10) / 10, color: v.newColor });
    if (want.length < before.length + 1) popped++;
    const a = after.map(key).sort(), b = want.map(key).sort();
    t.expect(JSON.stringify(a) === JSON.stringify(b),
      `shot ${shot}: after ${a.length}, expected ${b.length}\n  missing ${b.filter(k => !a.includes(k))}\n  extra ${a.filter(k => !b.includes(k))}`);
    compared++;
  }
  t.log({ method, compared, popped, maxFramesForSearch: maxFrames, slowestSearchMs: Math.round(slowest * 10) / 10 });
  t.expect(popped >= 3, `only ${popped} of ${compared} shots popped anything`);
  return maxFrames;
}

test("bubble probe: on random boards, the queue search finds exactly what a grid flood fill finds, in one frame", async t => {
  const frames = await randomBoards(t, "queue");
  t.expect(frames <= 1, `the search took up to ${frames} frames`);
});

test("bubble probe: on random boards, the recursive search finds the same, in one frame", async t => {
  const frames = await randomBoards(t, "recursive");
  t.expect(frames <= 1, `the search took up to ${frames} frames`);
});

test("bubble probe: recursion with screen refresh finds the same, but over many frames", async t => {
  const frames = await randomBoards(t, "slow");
  t.expect(frames > 5, `the search took only ${frames} frames`);
});
