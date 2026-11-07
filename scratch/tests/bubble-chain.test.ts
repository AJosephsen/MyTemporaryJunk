// Tests for the Bubble Chain demo: matches and loose bubbles found with "touching color" rings instead of a grid.
import { test, type T, type Vars } from "../workbench/testing.ts";

const DEMO = "demos/bubble-chain/bubble-chain.sb3";
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
  .filter((x: any) => x.sprite.name === "Bubble" && !x.isOriginal)
  .map((x: any) => ({ x: Math.round(x.x * 10) / 10, y: Math.round(x.y * 10) / 10, color: Number(Object.values<any>(x.variables).find(v => v.name === "color").value) })) as Ball[]);

async function shoot(t: T, x: number, y: number, color: number): Promise<Vars> {
  await t.set("shotColor", color);
  await t.mouse(x, y);
  await t.frames(1);
  await t.hold("space"); await t.frames(1); await t.release("space");
  return t.until(v => v.phase === "aim", { max: 600, what: "the shot and the chain to finish" });
}

// What a grid-based game would do: flood fill by colour from the new bubble, then from the ceiling row.
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
  const anchored = grow(left.filter(b => Math.abs(b.y - 147) < 1), b => !match.has(b));   // the top row hangs from the ceiling
  return left.filter(b => anchored.has(b));
}
const key = (b: Ball) => `${Math.round(b.x)},${Math.round(b.y)},${b.color}`;

test("bubble chain: three of a colour pop through touching rings, and a hanging bubble falls", async t => {
  await start(t, { [idx(0, 3)]: 2, [idx(1, 3)]: 1, [idx(2, 3)]: 3, [idx(2, 4)]: 1 });
  const v = await shoot(t, 0, 100, 1);
  const left = await balls(t);
  t.expect(v.markedCount === 3, `marked ${v.markedCount}`);
  t.expect(v.dropped === 1, `dropped ${v.dropped}`);
  t.expect(left.length === 1 && left[0].color === 2, `left: ${JSON.stringify(left)}`);
});

test("bubble chain: two of a colour do not pop and lose their rings", async t => {
  await start(t, { [idx(0, 3)]: 2, [idx(0, 0)]: 3 });
  const v = await shoot(t, 0, 100, 2);
  const left = await balls(t);
  t.expect(v.markedCount === 2 && left.length === 3, `marked ${v.markedCount}, bubbles ${left.length}`);
  const costumes = await t.page(w => w.vm.runtime.targets.filter((x: any) => x.sprite.name === "Bubble" && !x.isOriginal)
    .map((x: any) => x.getCostumes()[x.currentCostume].name));
  t.expect(costumes.every((c: string) => !c.includes(" ")), `costumes after unmarking: ${costumes}`);
});

test("bubble chain: a long chain spreads round by round until nothing new joins", async t => {
  const cells: Record<number, number> = {};
  for (let c = 0; c < 8; c++) cells[idx(0, c)] = 1;       // a whole row of colour 1
  cells[idx(1, 0)] = 3;                                     // and one other colour hanging below it
  await start(t, cells);
  const v = await shoot(t, 60, 100, 1);
  const left = await balls(t);
  t.expect(v.markedCount === 9, `marked ${v.markedCount} (8 in the row and the new bubble)`);
  t.expect(left.length === 0 && v.dropped === 1, `left ${left.length}, dropped ${v.dropped}`);
});

test("bubble chain: on random boards, rings find exactly what a grid flood fill finds", async t => {
  await t.load(DEMO);
  await t.greenFlag();
  let compared = 0, popped = 0;
  for (let shot = 0; shot < 25; shot++) {
    await t.until(v => v.phase === "aim", { max: 600 });
    const before = await balls(t);
    // the demo has no game over: stop when the board is empty or reaches down towards the launcher
    if (before.length === 0 || before.some(b => b.y < -90)) break;
    // aim like a player: at one of the lowest bubbles, with its colour
    const low = [...before].sort((a, b) => a.y - b.y).slice(0, 6);
    const target = low[(shot * 5) % low.length];
    const v = await shoot(t, target.x, target.y, target.color);
    const after = await balls(t);
    const want = expected(before, { x: Math.round(v.newX * 10) / 10, y: Math.round(v.newY * 10) / 10, color: v.newColor });
    const a = after.map(key).sort(), b = want.map(key).sort();
    if (want.length < before.length + 1) popped++;
    t.expect(JSON.stringify(a) === JSON.stringify(b),
      `shot ${shot}: after ${a.length} bubbles, expected ${b.length}\n  missing ${b.filter(k => !a.includes(k))}\n  extra ${a.filter(k => !b.includes(k))}`);
    compared++;
  }
  t.log({ compared, popped });
  t.expect(popped >= 3, `only ${popped} of ${compared} shots popped anything; the test needs more pops to mean much`);
});
