// Tests for the Chimney Drop tutorial (the game is step 6). They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";

const step = (n: number) => `tutorials/chimney-drop/step${n}.sb3`;
const pic = (n: number) => new URL(`../tutorials/chimney-drop/step${n}.png`, import.meta.url).pathname;
const clones = (t: T, name: string) => t.page((w, name) => w.vm.runtime.targets
  .filter((c: any) => !c.isOriginal && c.sprite.name === name && c.visible).map((c: any) => ({ x: c.x, y: c.y, costume: c.getCostumes()[c.currentCostume].name })), name) as
  Promise<{ x: number; y: number; costume: string }[]>;
async function start(t: T, n: number, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(step(n)); await t.greenFlag(); await t.frames(2);
}
const press = async (t: T, key: string, frames = 1) => { await t.hold(key); await t.frames(frames); await t.release(key); };
// Waits until a chimney is about to pass under the sleigh, then drops a present (aimed: the houses move on while it falls).
async function deliver(t: T, lead = 0) {
  const sleigh = await t.sprite("Sleigh");
  for (let f = 0; f < 400; f++) {
    const ch = (await clones(t, "Chimney")).find(c => c.x + 27 > sleigh.x + lead && c.x + 27 < sleigh.x + lead + 8);
    if (ch) { await press(t, "space"); return true; }
    await t.frames(1);
  }
  return false;
}

test("chimney drop step 1: the arrow keys move the sleigh, and it stays on the screen", async t => {
  await start(t, 1);
  await press(t, "right arrow", 20);
  t.near((await t.sprite("Sleigh")).x, 100, 6, "x after right");
  await press(t, "left arrow", 80);
  t.near((await t.sprite("Sleigh")).x, -180, 1, "x stops at the left side");
  await press(t, "right arrow", 30);
  await t.screenshot(pic(1));
});

test("chimney drop step 2: houses with chimneys come from the right and move left together", async t => {
  await start(t, 2);
  await t.frames(150);
  const h = await clones(t, "House"), c = await clones(t, "Chimney");
  t.expect(h.length >= 1 && h.length === c.length, `${h.length} houses, ${c.length} chimneys`);
  t.expect(h.every((x, i) => Math.abs(x.x - c[i].x) < 0.01 && Math.abs(x.y - c[i].y) < 0.01), "each chimney sits on its house");
  const x0 = h[0].x; await t.frames(10);
  t.near((await clones(t, "House"))[0].x, x0 - 20, 0.5, "houses move 2 a frame");
  await t.screenshot(pic(2));
});

test("chimney drop step 3: Space drops a present from the sleigh; it falls to the snow", async t => {
  await start(t, 3);
  await t.frames(30);
  await press(t, "space");
  await t.frames(3);
  let p = await clones(t, "Present");
  const s = await t.sprite("Sleigh");
  t.expect(p.length === 1 && Math.abs(p[0].x - s.x) < 1 && p[0].y < s.y, `present at ${JSON.stringify(p[0])}`);
  await t.frames(10);
  await t.screenshot(pic(3));
  await t.frames(60);
  p = await clones(t, "Present");
  t.expect(p.length === 0, "the present is gone in the snow");
});

for (const compiler of [true, false]) test(`chimney drop step 4: a present down a chimney scores and the chimney glows (${compiler ? "compiled" : "interpreted"})`, async t => {
  await start(t, 4, compiler);
  t.expect(await deliver(t, 66), "a chimney came");
  await t.until(v => Number(v.score) === 1, { max: 60, what: "the delivery" });
  await t.frames(3);
  const glowing = (await clones(t, "Chimney")).filter(c => c.costume === "glow").length;
  t.expect(glowing === 1, `${glowing} glowing chimneys`);
  if (compiler) { await t.frames(20); await t.screenshot(pic(4)); }
});

test("chimney drop step 5: misses cost presents; an empty sack ends the night", async t => {
  await start(t, 5);
  t.expect(Number(await t.get("presents")) === 5, "five presents to miss");
  // Drop straight into the snow, far from any chimney: a miss each.
  for (let i = 0; i < 5; i++) { await press(t, "space"); await t.frames(16); }
  await t.until(v => Number(v.presents) === 0, { max: 90, what: "the sack to empty" });
  await t.frames(5);
  const said = await t.page(w => { const s = w.vm.runtime.getSpriteTargetByName("Sleigh"); return w.vm.runtime.getTargetForStage() && (s as any).getCustomState?.("Scratch.looks")?.text; });
  t.expect(String(said).startsWith("Merry Christmas"), `Santa says "${said}"`);
  await t.screenshot(pic(5));
  await t.frames(100);
  t.expect(!(await t.page(w => w.vm.runtime.threads.some((th: any) => th.target.sprite.name === "Sleigh"))), "and then stop all");
});

test("chimney drop step 6: snow falls; deliveries make the town go faster", async t => {
  await start(t, 6);
  await t.frames(60);
  t.expect((await clones(t, "Snow")).length > 10, `it snows (${(await clones(t, "Snow")).length} flakes)`);
  for (let i = 0; i < 3; i++) t.expect(await deliver(t, 66 * Number(await t.get("speed")) / 2), "a chimney came"), await t.frames(40);
  const v = await t.vars();
  t.expect(Number(v.score) >= 2 && Number(v.speed) === 2 + Number(v.score) / 5, `score ${v.score}, speed ${v.speed}`);
  await t.screenshot(pic(6));
});
