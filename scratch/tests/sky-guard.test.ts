// Tests for the Sky Guard tutorial (the game is step 4). They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";

const step = (n: number) => `tutorials/sky-guard/step${n}.sb3`;
const shot = (n: number) => new URL(`../tutorials/sky-guard/step${n}.png`, import.meta.url).pathname;
const clones = (t: T, name: string) => t.page((w, name) => w.vm.runtime.targets
  .filter((c: any) => !c.isOriginal && c.sprite.name === name).map((c: any) => ({ x: c.x, y: c.y })), name) as Promise<{ x: number; y: number }[]>;
const start = async (t: T, n: number) => { await t.load(step(n)); await t.greenFlag(); await t.frames(2); };
// Puts a meteor clone at (x, y), the way "create clone" does.
const meteorAt = (t: T, x: number, y: number) => t.page((w, p) => {
  const rt = w.vm.runtime, c = rt.getSpriteTargetByName("Meteor").makeClone(); rt.addTarget(c); c.setXY(p.x, p.y);
}, { x, y });
const click = async (t: T, x: number, y: number) => { await t.mouse(x, y, true); await t.frames(2); await t.mouse(x, y, false); };

test("sky guard step 1: the cannon points towards the mouse", async t => {
  await start(t, 1);
  await t.mouse(100, 0); await t.frames(2);
  const s = await t.sprite("Cannon");
  t.near(s.direction, Math.atan2(100, 150) * 180 / Math.PI, 1, "direction");
  await t.mouse(-150, 60); await t.frames(2);
  t.near((await t.sprite("Cannon")).direction, Math.atan2(-150, 210) * 180 / Math.PI, 1, "direction");
  await t.screenshot(shot(1));
});

test("sky guard step 2: a click shoots one bullet, which flies in the cannon's direction to the edge", async t => {
  await start(t, 2);
  await t.mouse(0, 100); await t.frames(2);
  await click(t, 0, 100);
  await t.frames(3);
  let b = await clones(t, "Bullet");
  t.expect(b.length === 1, `${b.length} bullets`);
  t.expect(Math.abs(b[0].x) < 2 && b[0].y > -150, `bullet at ${JSON.stringify(b[0])}`);
  await t.frames(8);
  await t.screenshot(shot(2));
  await t.frames(30);
  b = await clones(t, "Bullet");
  t.expect(b.length === 0, "the bullet did not go at the edge");
  // Holding the mouse down shoots again and again, with a pause between bullets.
  await t.mouse(0, 100, true); await t.frames(40); await t.mouse(0, 100, false);
  const n = (await clones(t, "Bullet")).length;
  t.expect(n >= 3 && n <= 6, `${n} bullets while holding`);
});

test("sky guard step 3: meteors fall; a bullet pops one and scores", async t => {
  await start(t, 3);
  await t.frames(60);
  const m = await clones(t, "Meteor");
  t.expect(m.length >= 1 && m.every(c => c.y < 190), `${m.length} meteors`);
  // A meteor straight above the cannon: aim at it and shoot.
  await meteorAt(t, 0, 100);
  await t.mouse(0, 100); await t.frames(2);
  await click(t, 0, 100);
  const before = (await clones(t, "Meteor")).length;
  await t.frames(12);
  await t.screenshot(shot(3));
  const v = await t.until(v => Number(v.score) >= 1, { max: 40, what: "the hit" });
  t.expect(Number(v.score) === 1, `score ${v.score}`);
  t.expect((await clones(t, "Meteor")).length <= before - 1, "the meteor did not pop");
});

test("sky guard step 4: a meteor that lands costs a life; meteors speed up; game over at 0 lives", async t => {
  await start(t, 4);
  await meteorAt(t, -150, -100);
  const v = await t.until(v => Number(v.lives) === 2, { max: 60, what: "the meteor to land" });
  t.expect(Number(v.lives) === 2, `lives ${v.lives}`);
  await t.set("score", 30); await t.frames(2);
  t.near(Number(await t.get("speed")), 5, 0.01, "speed at score 30");
  await meteorAt(t, -120, 120); await meteorAt(t, 60, 40); await meteorAt(t, 170, 150);
  await t.mouse(60, 40); await t.frames(2); await click(t, 60, 40); await t.frames(6);
  await t.screenshot(shot(4));
  await t.set("lives", 0); await t.frames(3);
  t.expect((await t.sprite("Cannon")).bubble.startsWith("Game over"), "no game over message");
  await t.frames(70);
  const running = await t.page(w => w.vm.runtime.threads.length);
  t.expect(running === 0, `${running} scripts still running`);
});
