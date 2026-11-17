// Tests for the Chain Spark tutorial (the game is step 6). They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";

const step = (n: number) => `tutorials/chain-spark/step${n}.sb3`;
const pic = (n: number) => new URL(`../tutorials/chain-spark/step${n}.png`, import.meta.url).pathname;
type C = { x: number; y: number; dir: number; costume: string; role: string };
const clones = (t: T) => t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Firework")
  .map((c: any) => ({ x: c.x, y: c.y, dir: c.direction, costume: c.getCostumes()[c.currentCostume].name,
    role: (Object.values(c.variables) as any[]).find((x: any) => x.name === "role").value }))) as Promise<C[]>;
const fireworks = async (t: T) => (await clones(t)).filter(c => c.role !== "spark");
async function start(t: T, n: number, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(step(n)); await t.greenFlag(); await t.frames(3);
}
// Drags the sprite at (x1, y1) to (x2, y2) the way the Scratch editor does: pick what is under the pointer and, if it is
// draggable, move it with the VM's drag calls. (The workbench sends mouse input straight to the VM, which does not drag.)
async function drag(t: T, x1: number, y1: number, x2: number, y2: number) {
  const ok = await t.page((w, [x1, y1, x2, y2]) => {
    const r = w.vm.renderer, c = r.canvas, cw = c.clientWidth || 480, ch = c.clientHeight || 360;
    const id = r.pick((x1 + 240) * cw / 480, (180 - y1) * ch / 360);
    const target = w.vm.runtime.getTargetByDrawableId(id);
    if (!target || !target.draggable) return false;
    w.vm.startDrag(target.id); target.setXY(x2, y2, true); w.vm.stopDrag(target.id);
    return true;
  }, [x1, y1, x2, y2]);
  await t.frames(2);
  return ok;
}
const click = async (t: T, x: number, y: number) => { await t.mouse(x, y, true); await t.frames(1); await t.mouse(x, y, false); await t.frames(2); };
const press = async (t: T, key: string) => { await t.hold(key); await t.frames(1); await t.release(key); };
// Puts the fireworks of the tray where we want them: [tray index, x, y].
async function place(t: T, moves: [number, number, number][]) {
  const tray = await fireworks(t);
  for (const [i, x, y] of moves) await drag(t, tray[i].x, tray[i].y, x, y);
}

test("chain spark step 1: fireworks wait in the tray; drag one into the sky, click it to turn it", async t => {
  await start(t, 1);
  const tray = await fireworks(t);
  t.expect(tray.length === 8 && tray.every(c => c.y < -150), `${tray.length} fireworks in the tray`);
  await place(t, [[3, -60, 60], [0, -140, 0], [6, 120, -40]]);
  const f = await fireworks(t);
  t.expect(f.filter(c => c.y > -100).length === 3, `three in the sky: ${JSON.stringify(f.map(c => [c.x, c.y]))}`);
  const r = f.find(c => c.costume === "rocket" && c.y > -100)!;
  await click(t, r.x, r.y); await click(t, r.x, r.y);
  const r2 = (await fireworks(t)).find(c => c.costume === "rocket" && c.y > -100)!;
  t.near(r2.dir, 90, 0.5, "the rocket (pointing up) turned twice by 45");
  t.near(r2.x, r.x, 0.5, "a click does not move it");
  await t.screenshot(pic(1));
});

test("chain spark step 2: Space lights the match; the shell touching it bursts into a ring of 20 sparks", async t => {
  await start(t, 2);
  await place(t, [[3, 0, 40]]);
  await drag(t, 205, -158, 22, 40);
  await press(t, "space"); await t.frames(14);
  const sparks = (await clones(t)).filter(c => c.role === "spark");
  t.expect(sparks.length === 20, `${sparks.length} sparks`);
  const dirs = new Set(sparks.map(s => Math.round(((s.dir % 360) + 360) % 360)));
  t.expect(dirs.size === 20, `20 different directions: ${[...dirs]}`);
  await t.frames(4);
  await t.screenshot(pic(2));
});

for (const compiler of [true, false]) test(`chain spark step 3: a burst sets off the next firework: a chain reaction (${compiler ? "compiled" : "interpreted"})`, async t => {
  await start(t, 3, compiler);
  await place(t, [[3, -120, 40], [4, -40, 60], [5, 50, 40]]);
  t.expect((await fireworks(t)).filter(c => c.y > -100).length === 3, "three shells in the sky");
  await drag(t, 205, -158, -100, 40);
  await press(t, "space");
  await t.frames(compiler ? 25 : 25);
  if (compiler) await t.screenshot(pic(3));
  await t.frames(60);
  const left = (await fireworks(t)).filter(c => c.y > -100);
  t.expect(left.length === 0, `all three went off (${left.length} left)`);
});

test("chain spark step 4: a rocket flies its way leaving sparks; a fountain sprays", async t => {
  await start(t, 4);
  await place(t, [[0, -180, -60], [6, 40, 20]]);
  // Turn the rocket to point right (two clicks: 90 + 45 + 45 = 180? it points up at 90... it was drawn up and shown at 90).
  const r = (await fireworks(t)).find(c => c.costume === "rocket" && c.y > -100)!;
  await drag(t, 205, -158, -180, -30);
  await press(t, "space"); await t.frames(12);
  const rk = (await fireworks(t)).find(c => c.costume === "rocket" && c.y > -100);
  t.expect(!!rk && rk.y > r.y + 40, `the rocket flew up (${rk?.y})`);
  t.expect((await clones(t)).filter(c => c.role === "spark" && c.costume === "spark-red").length > 5, "a trail of sparks");
  await t.frames(40);
  await t.screenshot(pic(4));
});

test("chain spark step 5: points for each firework (rockets few) and show-time points", async t => {
  await start(t, 5);
  await place(t, [[3, -60, 40]]);
  await drag(t, 205, -158, -40, 40);
  await press(t, "space"); await t.frames(5);
  t.expect(Number(await t.get("score")) === 5 && Number(await t.get("burning")) === 1, `shell: score ${await t.get("score")}`);
  await t.frames(60);
  t.expect(Number(await t.get("burning")) === 0, "nothing burns any more");
});

test("chain spark step 6: a long chain over the sky: all eight go off, the finale bonus, the end of the show", async t => {
  await start(t, 6);
  // A fountain lights a rocket that flies right; its trail lights two shells, the shells light the rest.
  await place(t, [[6, -200, -80], [0, -200, 10], [3, -110, 24], [4, -30, 0], [5, 70, 20], [1, 130, 40], [2, -120, 100], [7, 150, -40]]);
  const rocket = (await fireworks(t)).find(c => c.x === -200 && c.y === 10)!;
  await click(t, rocket.x, rocket.y); await click(t, rocket.x, rocket.y);      // turn it to point right
  await drag(t, 205, -158, -200, -55);
  await press(t, "space");
  let most = 0;
  for (let f = 0; f < 150 && (await t.get("phase")) !== "over"; f++) {
    await t.frames(10);
    most = Math.max(most, Number(await t.get("burning")));
    if (f === 3) await t.screenshot(pic(6));
  }
  const v = await t.vars();
  t.log({ score: v.score, fired: v.fired, mostBurningAtOnce: most });
  t.expect(v.phase === "over" && Number(v.fired) === 8, `phase ${v.phase}, fired ${v.fired}`);
  // 3 rockets, 3 shells, 2 fountains, show-time points and the finale bonus.
  t.expect(Number(v.score) > 3 * 1 + 3 * 5 + 2 * 3 + 50, `score ${v.score}`);
});
