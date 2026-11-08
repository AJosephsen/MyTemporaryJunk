// Tests for Beanstalk Bounce.
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/beanstalk-bounce/beanstalk-bounce.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user-MyTemporaryJunk/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
type Leaf = { x: number; wy: number };
const leaves = (t: T) => t.page(w => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Leaf")
  .map((c: any) => ({ x: c.x, wy: Number((Object.values(c.variables) as any[]).find((x: any) => x.name === "wy").value) }))) as Promise<Leaf[]>;
const start = async (t: T) => { await t.load(GAME); await t.greenFlag(); await t.frames(3); };

// A simple player: after every bounce, pick the lowest leaf above the one it bounced from, and steer towards it.
async function climb(t: T, frames: number) {
  let held = "", lastVy = 0, from = -150;
  for (let i = 0; i < frames; i++) {
    const v = await t.vars();
    if (v.phase !== "play") break;
    const fy = Number(v.fy), fx = Number(v.fx), vy = Number(v.vy);
    if (vy > 0 && lastVy <= 0) from = fy - 30;
    lastVy = vy;
    const next = (await leaves(t)).filter(l => l.wy > from + 10 && l.wy < from + 115).sort((a, b) => a.wy - b.wy)[0];
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
