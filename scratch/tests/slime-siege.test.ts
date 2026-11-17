// Tests for the Slime Siege tutorial (the game is step 7). They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";

const step = (n: number) => `tutorials/slime-siege/step${n}.sb3`;
const pic = (n: number) => new URL(`../tutorials/slime-siege/step${n}.png`, import.meta.url).pathname;
type C = { x: number; y: number; dir: number; costume: string; vars: Record<string, any>; size: number };
const clones = (t: T, name: string) => t.page((w, name) => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === name)
  .map((c: any) => ({ x: c.x, y: c.y, dir: c.direction, size: c.size, costume: c.getCostumes()[c.currentCostume].name,
    vars: Object.fromEntries((Object.values(c.variables) as any[]).map((x: any) => [x.name, x.value])) })), name) as Promise<C[]>;
const towers = async (t: T) => (await clones(t, "Tower")).filter(c => c.vars.role === "tower");
const bolts = async (t: T) => (await clones(t, "Tower")).filter(c => c.vars.role === "bolt");
async function start(t: T, n: number, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(step(n)); await t.greenFlag(); await t.frames(3);
}
async function buyTower(t: T, x: number, y: number) {
  await t.mouse(-205, -152, true); await t.frames(2);
  for (let i = 1; i <= 6; i++) { await t.mouse(-205 + (x + 205) * i / 6, -152 + (y + 152) * i / 6, true); await t.frames(1); }
  await t.mouse(x, y, false); await t.frames(3);
}
const click = async (t: T, x: number, y: number) => { await t.mouse(x, y, true); await t.frames(1); await t.mouse(x, y, false); await t.frames(2); };
// A slime clone at (x, y), made the way "create clone" does.
const slimeAt = (t: T, x: number, y: number) => t.page((w, p) => {
  const rt = w.vm.runtime, c = rt.getSpriteTargetByName("Slime").makeClone(); rt.addTarget(c); c.setXY(p.x, p.y);
  return c.id;
}, { x, y });
const setSlimes = (t: T, name: string, value: number) => t.page((w, [n, x]) => {
  for (const c of w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Slime"))
    for (const v of Object.values(c.variables) as any[]) if (v.name === n) v.value = x; }, [name, value]);
const angle = (fx: number, fy: number, tx: number, ty: number) => (Math.atan2(tx - fx, ty - fy) * 180 / Math.PI);
const dirDiff = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

test("slime siege step 1: slimes come from the right and zigzag towards the keep", async t => {
  await start(t, 1);
  await t.frames(150);
  const dirs: number[] = [];
  for (let i = 0; i < 20; i++) { await t.frames(3); const s = await clones(t, "Slime"); if (s[0]) dirs.push(s[0].dir); }
  const s = await clones(t, "Slime");
  t.expect(s.length >= 1 && s.every(c => c.x < 230), `slimes ${JSON.stringify(s.map(c => [Math.round(c.x), Math.round(c.y)]))}`);
  t.expect(Math.max(...dirs) - Math.min(...dirs) > 20, `it zigzags: directions ${dirs.map(Math.round)}`);
  await t.frames(200);
  await t.screenshot(pic(1));
});

test("slime siege step 2: drag a tower anywhere on the meadow; not on another tower, the keep or the toolbar", async t => {
  await start(t, 2);
  await buyTower(t, 40, 25);
  let tw = await towers(t);
  t.expect(tw.length === 1 && Math.abs(tw[0].x - 40) < 1 && Math.abs(tw[0].y - 25) < 1, `placed at ${JSON.stringify(tw.map(c => [c.x, c.y]))}`);
  t.expect(Number(await t.get("coins")) === 75, `coins ${await t.get("coins")}`);
  await buyTower(t, 50, 30);            // on the first one
  await buyTower(t, -190, 20);          // on the keep
  await buyTower(t, 100, -150);         // in the toolbar
  t.expect((await towers(t)).length === 1 && Number(await t.get("coins")) === 75, "not placed, not paid");
  await buyTower(t, -60, -50); await buyTower(t, 120, 110);
  await t.screenshot(pic(2));
});

for (const compiler of [true, false]) test(`slime siege step 3: a cannon scans, finds a slime with its beam and aims at it (${compiler ? "compiled" : "interpreted"})`, async t => {
  await start(t, 3, compiler);
  await buyTower(t, 0, 20);
  // No new slimes: stop the Slime sprite's own script (it sends them out).
  await t.page(w => { const s = w.vm.runtime.getSpriteTargetByName("Slime"); for (const th of w.vm.runtime.threads.filter((x: any) => x.target === s)) w.vm.runtime._stopThread(th); });
  await slimeAt(t, 100, 90);
  await setSlimes(t, "speed", 0);
  let locked = false;
  for (let f = 0; f < 120 && !locked; f++) { await t.frames(1); locked = Number((await towers(t))[0].vars.locked) === 1; }
  const tw = (await towers(t))[0], sl = (await clones(t, "Slime"))[0];
  t.expect(locked, "locked on");
  t.expect(dirDiff(tw.dir, angle(tw.x, tw.y, sl.x, sl.y)) < 25, `aims at it: ${Math.round(tw.dir)} vs ${Math.round(angle(tw.x, tw.y, sl.x, sl.y))}`);
  if (compiler) await t.screenshot(pic(3));
});

for (const compiler of [true, false]) test(`slime siege step 4: bolts fly where the cannon points and destroy slimes for coins; the keep costs a life (${compiler ? "compiled" : "interpreted"})`, async t => {
  await start(t, 4, compiler);
  await buyTower(t, 0, 20);
  await slimeAt(t, 120, -40);
  await t.until(v => Number(v.coins) >= 85, { max: 600, what: "a slime to be destroyed" });
  await slimeAt(t, -150, 20);
  await t.until(v => Number(v.lives) <= 4, { max: 300, what: "a slime at the keep" });
  if (compiler) await t.screenshot(pic(4));
});

test("slime siege step 5: a slime chews a tower in its way; Repair mends it", async t => {
  await start(t, 5);
  await buyTower(t, -120, 20);
  await slimeAt(t, -90, 20);
  await setSlimes(t, "health", 999);
  await t.frames(160);
  const hurt = (await towers(t))[0];
  t.expect(Number(hurt.vars.hp) < 20, `chewed: hp ${hurt.vars.hp}`);
  await t.screenshot(pic(5));
  await click(t, 120, -152);                 // the Repair tool
  await click(t, -120, 20);                  // the tower
  t.expect(Number((await towers(t))[0].vars.hp) >= 19, `repaired: hp ${(await towers(t))[0].vars.hp}`);
});

test("slime siege step 6: upgrades: speed, damage (red bolts), pierce, strength; each costs coins", async t => {
  await start(t, 6);
  await t.page(w => { for (const x of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (x.name === "coins") x.value = 500; });
  await buyTower(t, 20, 30);
  for (const [tx, ty] of [[-120, -152], [20, 30], [-60, -152], [20, 30], [0, -152], [20, 30], [60, -152], [20, 30]]) await click(t, tx, ty);
  const tw = (await towers(t))[0];
  t.expect(Number(tw.vars.delay) === 0.35 && Number(tw.vars.power) === 2 && Number(tw.vars.pierce) === 1 && Number(tw.vars.maxhp) === 40,
    `upgraded: ${JSON.stringify(tw.vars)}`);
  t.expect(Number(await t.get("coins")) === 500 - 25 - 20 - 30 - 30 - 15, `coins ${await t.get("coins")}`);
  await slimeAt(t, 140, 30);
  await t.frames(60);
  t.expect((await bolts(t)).length === 0 || (await bolts(t)).every(b => b.costume === "power"), "red bolts");
  await t.screenshot(pic(6));
});

test("slime siege step 7: waves get tougher and come from more sides; the keep falls when the lives run out", async t => {
  await start(t, 7);
  await t.page(w => { for (const x of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (x.name === "coins") x.value = 300; });
  for (const [x, y] of [[-110, 60], [-110, -30], [-30, 100], [-30, -60], [50, 20], [-60, 20]]) await buyTower(t, x, y);
  for (let f = 0; f < 60 && Number(await t.get("wave")) < 3; f++) await t.frames(30);
  t.expect(Number(await t.get("wave")) >= 3, `wave ${await t.get("wave")}`);
  await t.frames(60);
  await t.screenshot(pic(7));
  await t.page(w => { for (const x of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (x.name === "lives") x.value = 0; });
  await t.frames(5);
  const said = await t.page(w => (w.vm.runtime.getSpriteTargetByName("Tower") as any).getCustomState?.("Scratch.looks")?.text);
  t.expect(String(said).startsWith("The slimes got in"), `says "${said}"`);
});
