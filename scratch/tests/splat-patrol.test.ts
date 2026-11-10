// Tests for the Splat Patrol tutorial (the game is step 5). They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";

const step = (n: number) => `tutorials/splat-patrol/step${n}.sb3`;
const shot = (n: number) => new URL(`../tutorials/splat-patrol/step${n}.png`, import.meta.url).pathname;
type Win = { x: number; y: number; costume: string; clone: boolean; visible: boolean };
// All visible windows (the original in steps 1 and 2, the clones from step 3).
const windows = (t: T) => t.page(w => w.vm.runtime.targets.filter((c: any) => c.sprite.name === "Window" && c.visible)
  .map((c: any) => ({ x: c.x, y: c.y, costume: c.getCostumes()[c.currentCostume].name, clone: !c.isOriginal, visible: c.visible }))) as Promise<Win[]>;
const start = async (t: T, n: number) => { await t.load(step(n)); await t.greenFlag(); await t.frames(3); };
const PEOPLE = ["raccoon", "granny", "kid"];
// Waits until someone (optionally a given one) looks out of a window; returns that window.
async function someone(t: T, who?: string, max = 400): Promise<Win> {
  for (let i = 0; i < max; i++) {
    const w = (await windows(t)).find(w => who ? w.costume === who : PEOPLE.includes(w.costume));
    if (w) return w;
    await t.frames(1);
  }
  throw new Error(`nobody (${who ?? "anyone"}) looked out in ${max} frames`);
}
// Puts the mouse on a window, lets the crosshair follow, then clicks.
async function splat(t: T, w: Win) { await t.mouse(w.x, w.y); await t.frames(1); await t.click(w.x, w.y); await t.frames(2); }

test("splat patrol step 1: a window opens, a raccoon looks out, the window shuts again", async t => {
  await start(t, 1);
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) { seen.add((await windows(t))[0].costume); await t.frames(1); }
  t.expect(seen.has("raccoon") && seen.has("shut"), `costumes ${[...seen]}`);
  await someone(t, "raccoon");
  await t.mouse(60, -30); await t.frames(2);
  await t.screenshot(shot(1));
});

test("splat patrol step 2: splatting a raccoon scores, splashing a villager costs a point", async t => {
  await start(t, 2);
  let w = await someone(t, "raccoon");
  await splat(t, w);
  t.expect((await windows(t))[0].costume === "raccoon splat" && Number(await t.get("score")) === 1, `score ${await t.get("score")}`);
  await t.mouse(w.x + 70, w.y - 40); await t.frames(1);
  await t.screenshot(shot(2));
  w = await someone(t, "granny", 1200).catch(() => someone(t, "kid", 1200));
  await splat(t, w);
  t.expect(Number(await t.get("score")) === 0, `score ${await t.get("score")}`);
  // Clicking a shut window does nothing.
  await t.until(v => true, { max: 60 });
  const shut = (await windows(t))[0];
  if (shut.costume === "shut") { await splat(t, shut); t.expect(Number(await t.get("score")) === 0, "a shut window counted"); }
});

test("splat patrol step 3: a clone on every window of the cottage, each with its own visitors", async t => {
  await start(t, 3);
  const w = await windows(t);
  t.expect(w.length === 3 && w.every(x => x.clone), `${w.length} windows`);
  t.expect(JSON.stringify(w.map(x => [x.x, x.y]).sort()) === JSON.stringify([[-110, 20], [0, -88], [110, 20]].sort()), "wrong spots");
  const busy = new Set<string>();
  for (let i = 0; i < 300; i++) { for (const x of await windows(t)) if (PEOPLE.includes(x.costume)) busy.add(`${x.x}`); await t.frames(1); }
  t.expect(busy.size === 3, `only ${busy.size} windows had visitors`);
  await someone(t, "raccoon"); await t.mouse(40, 60); await t.frames(2);
  await t.screenshot(shot(3));
});

test("splat patrol step 4: a raccoon that is not splatted in time splats you; three lives", async t => {
  await start(t, 4);
  await someone(t, "raccoon");
  const v = await t.until(v => Number(v.lives) === 2, { max: 90, what: "the raccoon to splat back" });
  t.expect(Number(v.lives) === 2, `lives ${v.lives}`);
  await t.frames(2);
  t.expect((await t.sprite("Goo")).visible, "no goo on the screen");
  await t.screenshot(shot(4));
  await t.set("lives", 1);
  await t.until(v => Number(v.lives) === 0, { max: 600, what: "game over" });
  await t.frames(2);
  t.expect((await t.sprite("Crosshair")).bubble.startsWith("Game over"), "no game over message");
});

test("splat patrol step 5: the houses take turns and each round is harder", async t => {
  await start(t, 5);
  await t.set("lives", 99);                // nobody splats the raccoons here, so don't run out of lives
  t.expect((await windows(t)).length === 3, "round 1 is not the cottage");
  t.near(Number(await t.get("showTime")), 2.0, 0.001, "showTime in round 1");
  await t.until(v => Number(v.round) === 2, { max: 480, what: "round 2" });
  await t.frames(3);
  t.expect((await windows(t)).length === 4, `round 2 has ${(await windows(t)).length} windows`);
  t.near(Number(await t.get("showTime")), 1.8, 0.001, "showTime in round 2");
  t.expect(Number(await t.get("badChance")) === 66, `badChance ${await t.get("badChance")}`);
  await t.until(v => Number(v.round) === 3, { max: 480, what: "round 3" });
  await t.frames(3);
  t.expect((await windows(t)).length === 6, "round 3 is not the town house");
  await someone(t); await t.mouse(-60, 40); await t.set("lives", 3); await t.frames(2);
  await t.screenshot(shot(5));
  await t.set("lives", 99);
  await t.until(v => Number(v.round) === 4, { max: 480, what: "round 4" });
  await t.frames(3);
  t.expect((await windows(t)).length === 3, "round 4 is not the cottage again");
});
