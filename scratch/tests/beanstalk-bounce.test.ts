// Tests for Beanstalk Bounce.
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/beanstalk-bounce/beanstalk-bounce.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user-MyTemporaryJunk/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
type Leaf = { x: number; wy: number; kind: string; dx: number };
const leaves = (t: T) => t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Leaf")
  .map((c: any) => {
    const get = (n: string) => Number((Object.values(c.variables) as any[]).find((x: any) => x.name === n).value);
    return { x: c.x, wy: get("wy"), dx: get("dx"), kind: c.getCostumes()[c.currentCostume].name };
  })) as Promise<Leaf[]>;
// Puts the frog just above a new leaf of the given kind (and nothing else nearby), falling.
const landOn = (t: T, kind: string) => t.page((w, kind) => {
  const rt = w.vm.runtime;
  for (const c of rt.targets.slice()) if (!c.isOriginal && ["Leaf", "Bee"].includes(c.sprite.name)) { rt.stopForTarget(c); rt.disposeTarget(c); }
  const orig = rt.getSpriteTargetByName("Leaf"), c = orig.makeClone();
  rt.addTarget(c); c.setXY(0, -100); c.setCostume(c.getCostumeIndexByName(kind));
  for (const x of Object.values(c.variables) as any[]) { if (x.name === "wy") x.value = -100; if (x.name === "dx") x.value = 0; }
  const set = (n: string, val: any) => { for (const x of Object.values(rt.getTargetForStage().variables) as any[]) if (x.name === n) x.value = val; };
  set("nextY", 9999); set("fx", 0); set("fy", -60); set("vy", -1); set("camera", 0);
}, kind);
const start = async (t: T) => { await t.load(GAME); await t.greenFlag(); await t.frames(3); };

// A simple player: after every bounce, pick the lowest leaf above the one it bounced from, and steer towards it.
async function climb(t: T, frames: number) {
  let held = "", lastVy = 0, from = -150;
  for (let i = 0; i < frames; i++) {
    const v = await t.vars();
    if (v.phase !== "play") break;
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

test("beanstalk bounce: leaves fill the screen, gaps between the level numbers, the first under the frog", async t => {
  await start(t);
  const l = (await leaves(t)).sort((a, b) => a.wy - b.wy);
  const gaps = l.slice(1).map((x, i) => x.wy - l[i].wy);
  t.expect(l[0].wy === -150 && l[0].x === 0, `first leaf ${JSON.stringify(l[0])}`);
  t.expect(l.length >= 8 && l[l.length - 1].wy + 55 > 220, `${l.length} leaves up to ${l[l.length - 1].wy}`);
  t.expect(gaps.every(g => g >= 30 && g <= 55), `gaps ${gaps}`);
  await t.screenshot(shot("beanstalk-start"));
});

test("beanstalk bounce: the frog bounces on the first leaf, again and again", async t => {
  await start(t);
  let lowest = 999, bounces = 0, last = 0;
  for (let i = 0; i < 120; i++) {
    await t.frames(1);
    const v = await t.vars();
    lowest = Math.min(lowest, Number(v.fy));
    if (Number(v.vy) > 0 && last <= 0) bounces++;
    last = Number(v.vy);
  }
  t.expect(bounces >= 3 && lowest > -150, `${bounces} bounces, lowest ${lowest}`);
});

test("beanstalk bounce: a player who steers climbs; the camera follows and old leaves go", async t => {
  await start(t);
  await climb(t, 900);
  const v = await t.vars(), l = await leaves(t);
  t.log({ height: v.height, phase: v.phase, leaves: l.length, maxGap: v.maxGap });
  t.expect(Number(v.height) >= 100, `height ${v.height}`);
  t.expect(l.every(x => x.wy - Number(v.camera) > -205), "leaves below the screen were not removed");
  t.expect(l.length < 40, `${l.length} leaves`);
  await t.screenshot(shot("beanstalk-climb"));
});

test("beanstalk bounce: falling off the bottom ends the game", async t => {
  await start(t);
  await t.page(w => { for (const c of w.vm.runtime.targets.slice()) if (!c.isOriginal && c.sprite.name === "Leaf") { w.vm.runtime.stopForTarget(c); w.vm.runtime.disposeTarget(c); } });
  await t.set("nextY", 9999);          // and no new ones
  const v = await t.until(v => v.phase === "over", { max: 120, what: "the frog to fall off" });
  t.expect(Number(v.fy) < -190, `fy ${v.fy}`);
});

test("beanstalk bounce: a green leaf bounces, a mushroom bounces much higher, a dry leaf crumbles", async t => {
  await start(t);
  const peak = async (kind: string) => {
    await landOn(t, kind);
    let top = -999;
    for (let i = 0; i < 60; i++) { await t.frames(1); top = Math.max(top, Number(await t.get("fy"))); }
    return top;
  };
  const leaf = await peak("leaf"), mushroom = await peak("mushroom");
  t.log({ leaf, mushroom });
  t.expect(leaf > 0 && leaf < 50 && mushroom > 200, `peaks: leaf ${leaf}, mushroom ${mushroom}`);
  await landOn(t, "dry");
  const v = await t.until(v => v.phase === "over", { max: 120, what: "the frog to fall through the dry leaf" });
  t.expect(v.phase === "over", "");
});

test("beanstalk bounce: higher up there are moving leaves, dry leaves, mushrooms and bees", async t => {
  await start(t);
  const seen = { moving: 0, dry: 0, mushroom: 0, bees: 0 };
  for (let cam = 1000; cam <= 4000; cam += 300) {
    await t.set("camera", cam); await t.set("fy", cam); await t.set("vy", 0); await t.set("nextY", cam - 180);
    await t.frames(2);
    for (const l of await leaves(t)) { if (l.dx !== 0) seen.moving++; if (l.kind === "dry") seen.dry++; if (l.kind === "mushroom") seen.mushroom++; }
    seen.bees += await t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Bee").length);
  }
  t.log(seen);
  t.expect(seen.moving > 3 && seen.dry > 3 && seen.mushroom > 0 && seen.bees > 0, JSON.stringify(seen));
  await t.screenshot(shot("beanstalk-high"));
});

test("beanstalk bounce: a bee sting knocks the frog down", async t => {
  await start(t);
  await t.page(w => {
    const rt = w.vm.runtime, orig = rt.getSpriteTargetByName("Bee");
    for (const x of Object.values(orig.variables) as any[]) { if (x.name === "wy") x.value = -100; if (x.name === "dx") x.value = 0; }
    const c = orig.makeClone(); rt.addTarget(c);
    c.setXY(0, -100);
  });
  const v = await t.until(v => v.phase === "stung", { max: 120, what: "the bee to sting" });
  await t.frames(10);
  await t.screenshot(shot("beanstalk-stung"));
  await t.until(v => v.phase === "over", { max: 200, what: "the frog to fall off" });
  t.expect(v.phase === "stung", "");
});

test("beanstalk bounce: only the feet land; a head touching a leaf from below does not bounce", async t => {
  await start(t);
  // Feet just above the leaf: bounce.
  await landOn(t, "leaf");
  await t.set("fy", -78);
  let bounced = false;
  for (let i = 0; i < 10 && !bounced; i++) { await t.frames(1); bounced = Number(await t.get("vy")) > 5; }
  t.expect(bounced, "feet on the leaf did not bounce");
  // Head just under the leaf (the frog is below it), falling: no bounce.
  await landOn(t, "leaf");
  await t.set("fy", -122);
  let rose = false;
  for (let i = 0; i < 10; i++) { await t.frames(1); if (Number(await t.get("vy")) > 0) rose = true; }
  t.expect(!rose, "the frog bounced off the leaf with his head");
});
