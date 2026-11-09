// Tests for the Sheepdog tutorial (the game is step 4). They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";

const step = (n: number) => `tutorials/sheepdog/step${n}.sb3`;
const shot = (n: number) => new URL(`../tutorials/sheepdog/step${n}.png`, import.meta.url).pathname;
const sheep = (t: T) => t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Sheep")
  .map((c: any) => ({ x: c.x, y: c.y, visible: c.visible }))) as Promise<{ x: number; y: number; visible: boolean }[]>;
// The flock appears one sheep per frame, so wait a little after the green flag.
const start = async (t: T, n: number) => { await t.load(step(n)); await t.greenFlag(); await t.frames(12); };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
// Moves the first sheep clone to (x, y).
const sheepAt = (t: T, x: number, y: number) => t.page((w, p) => {
  w.vm.runtime.targets.find((c: any) => !c.isOriginal && c.sprite.name === "Sheep").setXY(p.x, p.y); }, { x, y });

test("sheepdog step 1: the dog runs to the mouse and stops there", async t => {
  await start(t, 1);
  await t.mouse(100, 50); await t.frames(90);
  const dog = await t.sprite("Dog");
  t.expect(dist(dog, { x: 100, y: 50 }) <= 12, `dog at ${dog.x}, ${dog.y}`);
  await t.mouse(-120, 80); await t.frames(20);
  await t.screenshot(shot(1));
  await t.frames(70);
  t.expect(dist(await t.sprite("Dog"), { x: -120, y: 80 }) <= 12, "the dog did not follow the second position");
});

test("sheepdog step 2: eight sheep graze on the left and stay on the field", async t => {
  await start(t, 2);
  const a = await sheep(t);
  t.expect(a.length === 8 && a.every(s => s.visible), `${a.length} sheep`);
  t.expect(a.every(s => s.x < 0), "a sheep started on the right");
  await t.frames(120);
  const b = await sheep(t);
  t.expect(b.some((s, i) => dist(s, a[i]) > 20), "the sheep did not move");
  t.expect(b.every(s => Math.abs(s.x) <= 240 && Math.abs(s.y) <= 180), "a sheep left the field");
  await t.screenshot(shot(2));
});

test("sheepdog step 3: a sheep runs away from the dog", async t => {
  await start(t, 3);
  await t.mouse(-180, -120); await t.frames(2);           // the dog stays in its corner
  await sheepAt(t, -100, -120);
  await t.place("Dog", -150, -120);
  await t.mouse(-150, -120); await t.frames(2);
  const before = (await sheep(t))[0];
  await t.frames(20);
  const after = (await sheep(t))[0];
  // It runs until it is about 70 steps from the dog, then grazes again.
  t.expect(after.x > before.x + 15 && dist(after, { x: -150, y: -120 }) >= 65, `sheep moved from ${before.x} to ${after.x}`);
  // Picture: the dog in the middle of the flock.
  await t.mouse(-110, 0); await t.frames(60);
  await t.screenshot(shot(3));
});

test("sheepdog step 4: a sheep driven into the pen stays and counts; all eight win", async t => {
  await start(t, 4);
  await t.mouse(-180, -120); await t.frames(2);
  await sheepAt(t, 60, 110);
  await t.place("Dog", 0, 110); await t.mouse(0, 110); await t.frames(2);
  const v = await t.until(v => Number(v.inside) >= 1, { max: 60, what: "the sheep to enter the pen" });
  t.expect(Number(v.inside) === 1, `inside ${v.inside}`);
  const s0 = (await sheep(t))[0];
  await t.frames(30);
  t.expect(dist(s0, (await sheep(t))[0]) < 1, "the penned sheep kept moving");
  await t.screenshot(shot(4));
  await t.frames(60);
  t.expect(Number(await t.get("time")) >= 3, `time ${await t.get("time")}`);
  await t.set("inside", 8); await t.frames(3);
  t.expect((await t.sprite("Dog")).bubble.startsWith("Well done"), "no win message");
  await t.frames(100);
  t.expect((await t.page(w => w.vm.runtime.threads.length)) === 0, "scripts still running after the win");
});
