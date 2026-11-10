// Tests for the Splat Patrol deluxe level (step 6, not in the tutorial): disguises, combos, particles and extras.
import { test, type T } from "../workbench/testing.ts";

const GAME = "games/splat-patrol/splat-patrol-deluxe.sb3";
const shot = (name: string) => `/tmp/claude-0/-home-user-MyTemporaryJunk/af299c66-140a-5320-8b1f-a09d589ac156/scratchpad/${name}.png`;
type Win = { x: number; y: number; costume: string };
// Visible clones. Windows report their home spot (homeX, homeY): when the house shakes they move a few pixels.
const clones = (t: T, name: string) => t.page((w, name) => w.vm.runtime.targets
  .filter((c: any) => c.sprite.name === name && !c.isOriginal && c.visible)
  .map((c: any) => {
    const home = (n: string) => (Object.values(c.variables) as any[]).find((x: any) => x.name === n)?.value;
    return { x: home("homeX") ?? c.x, y: home("homeY") ?? c.y, costume: c.getCostumes()[c.currentCostume].name };
  }), name) as Promise<Win[]>;
async function waitFor(t: T, who: string, max = 600): Promise<Win> {
  for (let i = 0; i < max; i++) {
    const w = (await clones(t, "Window")).find(w => w.costume === who);
    if (w) return w;
    await t.frames(1);
  }
  throw new Error(`no ${who} in ${max} frames`);
}
async function splat(t: T, w: Win) { await t.mouse(w.x, w.y); await t.frames(1); await t.click(w.x, w.y); await t.frames(2); }
// Starts the game at a round, with as many lives as needed and the given chances.
async function start(t: T, round = 1, set: Record<string, number> = {}) {
  await t.load(GAME); await t.greenFlag(); await t.frames(3);
  await t.set("lives", 99);            // nobody splats the raccoons while the test waits
  if (round > 1) {
    // (t.until runs in the page and can't see `round`, so wait here.)
    await t.set("round", round - 1);
    for (let i = 0; i < 500 && Number(await t.get("round")) !== round; i++) await t.frames(1);
    await t.frames(3);
  }
  for (const [k, v] of Object.entries(set)) await t.set(k, v);
}

test("splat patrol deluxe: disguised raccoons wink, and splatting one gives 3 points with drops and a pop-up", async t => {
  await start(t, 2, { badChance: 100, disguise: 100, lives: 99 });
  const w = await waitFor(t, "raccoon granny").catch(() => waitFor(t, "raccoon kid"));
  // It winks: half way through, the mask shows for a moment.
  let winked = false;
  for (let i = 0; i < 40 && !winked; i++) {
    winked = (await clones(t, "Window")).some(x => x.x === w.x && x.y === w.y && x.costume === "raccoon");
    if (!winked) await t.frames(1);
  }
  t.expect(winked, "the disguised raccoon did not wink");
  await t.frames(5);
  const now = (await clones(t, "Window")).find(x => x.x === w.x && x.y === w.y)!;
  const score = Number(await t.get("score"));
  await splat(t, now);
  t.expect(Number(await t.get("score")) === score + 3, `score ${score} → ${await t.get("score")}`);
  const drops = await clones(t, "Drop"), pops = await clones(t, "Popup");
  t.expect(drops.length >= 8 && pops.some(p => p.costume === "+3"), `${drops.length} drops, pop-ups ${pops.map(p => p.costume)}`);
  await t.mouse(w.x + 90, w.y - 70); await t.frames(4);
  await t.screenshot(shot("deluxe-splash"));
  await t.frames(40);
  t.expect((await clones(t, "Drop")).length === 0 && (await clones(t, "Popup")).length === 0, "the drops or pop-ups did not go");
});

test("splat patrol deluxe: three hits in a row make a combo; a splashed villager resets it", async t => {
  await start(t, 1, { badChance: 100, disguise: 0, lives: 99 });
  for (let i = 0; i < 3; i++) await splat(t, await waitFor(t, "raccoon"));
  let v = await t.vars();
  t.expect(Number(v.combo) === 2 && Number(v.streak) === 3, `combo ${v.combo}, streak ${v.streak}`);
  t.expect((await clones(t, "Popup")).some(p => p.costume === "x2"), "no COMBO x2 pop-up");
  const score = Number(v.score);
  await splat(t, await waitFor(t, "raccoon"));
  t.expect(Number(await t.get("score")) === score + 2, "the combo did not double the points");
  await t.set("badChance", 0);
  await splat(t, await waitFor(t, "granny").catch(() => waitFor(t, "kid")));
  v = await t.vars();
  t.expect(Number(v.combo) === 1 && Number(v.streak) === 0, `combo ${v.combo} after oops`);
  t.expect((await clones(t, "Popup")).some(p => p.costume === "oops"), "no OOPS pop-up");
});

test("splat patrol deluxe: a raccoon that gets you shakes the house and takes a heart", async t => {
  await start(t, 1, { badChance: 100, disguise: 0, lives: 3 });
  const where = () => t.page(w => w.vm.runtime.targets.filter((c: any) => c.sprite.name === "Window" && !c.isOriginal)
    .map((c: any) => `${c.x},${c.y}`).sort().join()) as Promise<string>;
  const home = await where();
  await waitFor(t, "raccoon");
  await t.until(v => Number(v.lives) === 2, { max: 90, what: "the raccoon to splat back" });
  await t.frames(2);
  t.expect((await where()) !== home, "the house did not shake");
  t.expect((await t.sprite("Hearts")).costume === "h2", `hearts ${(await t.sprite("Hearts")).costume}`);
  await t.frames(12);
  t.expect((await where()) === home, "the windows did not go back");
});

test("splat patrol deluxe: crosshair recoil, round banner, evening light and birds", async t => {
  await start(t, 1, { lives: 99 });
  await t.mouse(0, -150); await t.frames(1);
  await t.click(0, -150); await t.frames(1);
  t.expect(Number((await t.page(w => w.vm.runtime.getSpriteTargetByName("Crosshair").size))) > 110, "no recoil");
  await t.frames(10);
  t.near(Number(await t.page(w => w.vm.runtime.getSpriteTargetByName("Crosshair").size)), 100, 0.01, "size after the recoil");
  await t.set("round", 2);
  await t.until(v => Number(v.round) === 3, { max: 500, what: "round 3" });
  await t.frames(14);
  const banner = await t.sprite("Banner");
  t.expect(banner.visible && banner.costume === "townhouse", `banner ${banner.costume} ${banner.visible}`);
  t.expect(Number(await t.page(w => w.vm.runtime.getTargetForStage().effects.brightness)) === -20, "no evening light");
  await t.screenshot(shot("deluxe-banner"));
  let bird = false;
  for (let i = 0; i < 300 && !bird; i++) { bird = (await t.sprite("Bird")).visible; await t.frames(1); }
  t.expect(bird, "no bird flew by");
  await t.set("badChance", 100); await t.set("disguise", 100);
  await waitFor(t, "raccoon kid").catch(() => waitFor(t, "raccoon granny"));
  await t.mouse(150, -120); await t.frames(2);
  await t.screenshot(shot("deluxe-disguise"));
});
