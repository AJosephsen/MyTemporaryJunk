// Tests for the Beanstalk Bounce tutorial: every checkpoint works on its own. They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";

const step = (n: number) => `tutorials/beanstalk-bounce/step${n}.sb3`;
const shot = (n: number) => new URL(`../tutorials/beanstalk-bounce/step${n}.png`, import.meta.url).pathname;
type Leaf = { x: number; wy: number; kind: string };
const leaves = (t: T) => t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Leaf").map((c: any) => ({
  x: c.x, kind: c.getCostumes()[c.currentCostume].name,
  wy: Number((Object.values(c.variables) as any[]).find((x: any) => x.name === "wy").value) }))) as Promise<Leaf[]>;
const start = async (t: T, n: number) => { await t.page(w => w.vm.setCompilerOptions({ enabled: true })); await t.load(step(n)); await t.greenFlag(); await t.frames(3); };

// Steers towards the lowest (not dry) leaf above the one the frog last bounced from.
async function climb(t: T, frames: number, until?: (v: any) => boolean) {
  let held = "", lastVy = 0, from = -150;
  for (let i = 0; i < frames; i++) {
    const v = await t.vars();
    if (v.phase !== "play" || until?.(v)) break;
    const fy = Number(v.fy), fx = Number(v.fx), vy = Number(v.vy);
    if (vy > 0 && lastVy <= 0) from = fy - 12;   // the leaf just bounced from is a little below the frog's middle
    lastVy = vy;
    const next = (await leaves(t)).filter(l => l.kind !== "dry" && l.wy > from && l.wy < from + 115).sort((a, b) => a.wy - b.wy)[0];
    const want = !next || Math.abs(next.x - fx) < 8 ? "" : next.x > fx ? "right arrow" : "left arrow";
    if (want !== held) { if (held) await t.release(held); if (want) await t.hold(want); held = want; }
    await t.frames(1);
  }
  if (held) await t.release(held);
}

test("beanstalk bounce tutorial step 1: gravity and bounce", async t => {
  await start(t, 1);
  let bounces = 0, last = 0, lowest = 999;
  for (let i = 0; i < 90; i++) {
    await t.frames(1);
    const v = await t.vars();
    if (Number(v.vy) > 0 && last <= 0) bounces++;
    last = Number(v.vy); lowest = Math.min(lowest, Number(v.fy));
    if (i === 14) await t.screenshot(shot(1));
  }
  t.expect(bounces >= 2 && lowest > -150, `${bounces} bounces, lowest ${lowest}`);
  t.expect((await leaves(t)).length >= 6, "the screen is not filled with leaves");
});

test("beanstalk bounce tutorial step 2: the camera follows the frog up; falling off ends the game", async t => {
  await start(t, 2);
  await climb(t, 900, v => Number(v.height) >= 60);
  const v = await t.vars();
  t.expect(Number(v.height) >= 60, `height ${v.height}`);
  await t.screenshot(shot(2));
  await t.set("fy", Number(v.camera) - 300);
  const w = await t.until(v => v.phase === "over", { max: 10, what: "game over" });
  t.expect(w.phase === "over", "");
});

test("beanstalk bounce tutorial step 3: the gaps grow with the height", async t => {
  await start(t, 3);
  const gapsAt = async (camera: number) => {
    await t.set("camera", camera); await t.set("fy", camera); await t.set("vy", 8); await t.set("nextY", camera - 180);
    await t.frames(2);
    const l = (await leaves(t)).filter(x => x.wy > camera - 180).sort((a, b) => a.wy - b.wy);
    return l.slice(1).map((x, i) => x.wy - l[i].wy);
  };
  const low = await gapsAt(0), high = await gapsAt(3000);
  const v = await t.vars();
  t.log({ low, high, minGap: v.minGap, maxGap: v.maxGap, best: v.best });
  t.expect(Math.max(...low) <= 55 && Math.min(...high) >= 60 && Math.max(...high) <= 105, "gaps did not grow");
  t.expect(Number(v.best) >= 290, `best ${v.best}`);
  await t.screenshot(shot(3));
});

test("beanstalk bounce tutorial step 4: moving, dry and mushroom leaves", async t => {
  await start(t, 4);
  const kinds = new Set<string>();
  for (let cam = 1500; cam <= 3600; cam += 300) {
    await t.set("camera", cam); await t.set("fy", cam); await t.set("vy", 8); await t.set("nextY", cam - 180);
    await t.frames(2);
    for (const l of await leaves(t)) kinds.add(l.kind);
    if (kinds.has("dry") && kinds.has("mushroom")) break;
  }
  t.expect(kinds.has("dry") && kinds.has("mushroom"), `kinds ${[...kinds]}`);
  await t.screenshot(shot(4));
});

test("beanstalk bounce tutorial step 5: bees sting", async t => {
  await start(t, 5);
  await t.page(w => {
    const rt = w.vm.runtime, orig = rt.getSpriteTargetByName("Bee");
    for (const x of Object.values(orig.variables) as any[]) { if (x.name === "wy") x.value = -40; if (x.name === "dx") x.value = -3; }
    const c = orig.makeClone(); rt.addTarget(c); c.setXY(60, -40);
  });
  const v = await t.until(v => v.phase === "stung", { max: 120, what: "the bee to sting" });
  await t.frames(6);
  await t.screenshot(shot(5));
  t.expect(v.phase === "stung", "");
});
