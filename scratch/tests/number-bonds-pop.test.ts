// Tests for Number Bonds Pop (maths game: click two bubbles that make the target).
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/number-bonds-pop/number-bonds-pop.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
const list = (t: T, name: string) => t.get(name) as Promise<any[]>;

async function startGame(t: T, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(GAME); await t.greenFlag(); await t.frames(5);
  await t.hold("space"); await t.frames(1); await t.release("space");
  await t.until(v => v.phase === "play", { max: 10, what: "play" });
}
type Bubble = { j: number; n: number; kind: number; x: number; y: number };
async function onScreen(t: T): Promise<Bubble[]> {
  const [on, n, kind, x, y, merge] = await Promise.all(["on", "n", "kind", "x", "y", "merge"].map(f => list(t, `bub.${f}`)));
  return on.map((o, i) => ({ j: i + 1, on: Number(o), n: Number(n[i]), kind: Number(kind[i]), x: Number(x[i]), y: Number(y[i]), merge: Number(merge[i]) }))
    .filter(b => b.on === 1 && b.merge === 0 && b.y > -150 && b.y < 120);
}
// Waits for two visible bubbles that make (right) or do not make (wrong) the target.
async function findPair(t: T, right: boolean): Promise<[Bubble, Bubble]> {
  for (let i = 0; i < 900; i++) {
    const target = Number(await t.get("target")), all = await onScreen(t);
    // Only bubbles clear of the others, so a click hits the one we mean.
    const bs = all.filter(a => all.every(b => b === a || Math.hypot(a.x - b.x, a.y - b.y) > 80));
    for (const a of bs) for (const b of bs) if (a.j < b.j && a.kind === 0 && b.kind === 0 && ((a.n + b.n === target) === right)) return [a, b];
    await t.frames(1);
  }
  throw new Error(`no ${right ? "right" : "wrong"} pair came`);
}
// Clicks a bubble where it is now (it moves a little each frame).
async function tap(t: T, j: number) {
  const x = Number((await list(t, "slotX"))[j - 1]), y = Number((await list(t, "slotY"))[j - 1]);
  await t.mouse(x, y); await t.click(x, y); await t.frames(2);
}

test("number bonds pop: the title shows; a press starts level 1: make 10", async t => {
  await t.page(w => w.vm.setCompilerOptions({ enabled: true }));
  await t.load(GAME); await t.greenFlag(); await t.frames(20);
  await t.screenshot(shot("nbp-title"));
  await t.hold("space"); await t.frames(1); await t.release("space");
  const v = await t.until(v => v.phase === "play", { max: 10, what: "play" });
  t.expect(Number(v.target) === 10 && Number(v.level) === 1, `target ${v.target}`);
});

for (const compiler of [true, false]) test(`number bonds pop: two bubbles that make 10 pop and score; the sum shows (${compiler ? "compiled" : "interpreted"})`, async t => {
  await startGame(t, compiler);
  const [a, b] = await findPair(t, true);
  await tap(t, a.j);
  t.expect(Number(await t.get("sel1")) === a.j, `first bubble selected (${await t.get("sel1")})`);
  await tap(t, b.j);
  const v = await t.until(v => Number(v.pairsDone) === 1, { max: 5, what: "the pair" });
  t.expect(Number(v.score) === 100 && Number(v.sel1) === 0, `score ${v.score}`);
  await t.frames(4);
  if (compiler) await t.screenshot(shot("nbp-pop"));
  await t.frames(10);
  const on = (await list(t, "bub.on")).map(Number);
  t.expect(on[a.j - 1] === 0 && on[b.j - 1] === 0, `both popped: ${on}`);
});

test("number bonds pop: a wrong pair costs a heart; three end the game", async t => {
  await startGame(t);
  for (let h = 2; h >= 0; h--) {
    const [a, b] = await findPair(t, false);
    await tap(t, a.j); await tap(t, b.j);
    t.expect(Number(await t.get("hearts")) === h, `hearts ${await t.get("hearts")}, want ${h}`);
  }
  await t.until(v => v.phase === "over", { max: 5, what: "game over" });
  await t.frames(15);
  await t.screenshot(shot("nbp-over"));
  await t.until(v => v.phase === "ready", { max: 200, what: "ready" });
});

test("number bonds pop: three pairs in a row make ×2; a level of pairs moves on to bonds to 10 again, then 20", async t => {
  await startGame(t);
  for (let level = 1; level <= 2; level++) {
    const goal = Number(await t.get("goal"));
    for (let i = 0; i < goal; i++) {
      const [a, b] = await findPair(t, true);
      await tap(t, a.j); await tap(t, b.j);
      if (level === 1 && i === 2) t.expect(Number(await t.get("mult")) >= 2, `mult ${await t.get("mult")} after 3 pairs`);
    }
    await t.until(v => v.phase === "bonus", { max: 5, what: "bonus" });
    if (level === 1) { await t.frames(50); await t.screenshot(shot("nbp-levelup")); }
    await t.until(v => v.phase === "play", { max: 400, what: `level ${level + 1}` });
  }
  const v = await t.vars();
  const backdrop = await t.page(w => w.vm.runtime.getTargetForStage().getCostumes()[w.vm.runtime.getTargetForStage().currentCostume].name);
  t.expect(Number(v.level) === 3 && Number(v.target) === 20 && backdrop === "deep", `level ${v.level}, target ${v.target}, ${backdrop}`);
  await t.frames(150);
  await t.screenshot(shot("nbp-level3"));
});
