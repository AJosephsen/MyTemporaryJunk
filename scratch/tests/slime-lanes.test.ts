// Tests for the Slime Lanes tutorial (the game is step 7). They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";

const step = (n: number) => `tutorials/slime-lanes/step${n}.sb3`;
const pic = (n: number) => new URL(`../tutorials/slime-lanes/step${n}.png`, import.meta.url).pathname;
type C = { x: number; y: number; costume: string; vars: Record<string, any>; size: number };
const clones = (t: T, name: string) => t.page((w, name) => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === name)
  .map((c: any) => ({ x: c.x, y: c.y, size: c.size, costume: c.getCostumes()[c.currentCostume].name,
    vars: Object.fromEntries((Object.values(c.variables) as any[]).map((x: any) => [x.name, x.value])) })), name) as Promise<C[]>;
const towers = async (t: T) => (await clones(t, "Tower")).filter(c => c.vars.role === "tower");
const bolts = async (t: T) => (await clones(t, "Tower")).filter(c => c.vars.role === "bolt");
async function start(t: T, n: number, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(step(n)); await t.greenFlag(); await t.frames(3);
}
// Press on the shop, drag to (x, y), let go.
async function buyTower(t: T, x: number, y: number) {
  await t.mouse(-205, -152, true); await t.frames(2);
  for (let i = 1; i <= 6; i++) { await t.mouse(-205 + (x + 205) * i / 6, -152 + (y + 152) * i / 6, true); await t.frames(1); }
  await t.mouse(x, y, false); await t.frames(3);
}
const click = async (t: T, x: number, y: number) => { await t.mouse(x, y, true); await t.frames(1); await t.mouse(x, y, false); await t.frames(2); };
// A slime clone at (x, y), made the way "create clone" does.
const slimeAt = (t: T, x: number, y: number) => t.page((w, p) => {
  const rt = w.vm.runtime, c = rt.getSpriteTargetByName("Slime").makeClone(); rt.addTarget(c); c.setXY(p.x, p.y);
}, { x, y });

test("slime lanes step 1: slimes come along the four lanes and crawl to the castle", async t => {
  await start(t, 1);
  await t.frames(240);
  const s = await clones(t, "Slime");
  t.expect(s.length >= 2 && s.every(c => [90, 30, -30, -90].includes(c.y) && c.x < 230), `slimes ${JSON.stringify(s.map(c => [Math.round(c.x), c.y]))}`);
  await t.screenshot(pic(1));
});

test("slime lanes step 2: drag a tower from the shop onto a square; it costs coins; off the field it goes back", async t => {
  await start(t, 2);
  await buyTower(t, 40, 25);
  let tw = await towers(t);
  t.expect(tw.length === 1 && tw[0].x === 30 && tw[0].y === 30, `snapped to ${JSON.stringify(tw.map(c => [c.x, c.y]))}`);
  t.expect(Number(await t.get("coins")) === 75, `coins ${await t.get("coins")}`);
  await buyTower(t, 35, 35);                 // on top of the first one
  await buyTower(t, 200, 140);               // off the field
  t.expect((await towers(t)).length === 1 && Number(await t.get("coins")) === 75, "not placed, not paid");
  await buyTower(t, -90, -90);
  await t.screenshot(pic(2));
});

test("slime lanes step 3: a tower shoots bolts to the right along its lane", async t => {
  await start(t, 3);
  await buyTower(t, -90, -30);
  await t.frames(40);
  const b = await bolts(t);
  t.expect(b.length >= 1 && b.every(c => c.y === -30 && c.x > -90), `bolts ${JSON.stringify(b.map(c => [Math.round(c.x), c.y]))}`);
  await t.screenshot(pic(3));
});

for (const compiler of [true, false]) test(`slime lanes step 4: bolts destroy slimes for coins; a slime at the castle costs a life (${compiler ? "compiled" : "interpreted"})`, async t => {
  await start(t, 4, compiler);
  await buyTower(t, -150, 90);
  const coins = Number(await t.get("coins"));
  await slimeAt(t, 60, 90);
  await t.until(v => Number(v.coins) === 85, { max: 400, what: "the slime to be destroyed" });
  t.expect(coins === 75, `paid for the tower: ${coins}`);
  await slimeAt(t, -170, -90);
  await t.until(v => Number(v.lives) === 4, { max: 200, what: "a slime at the castle" });
  if (compiler) await t.screenshot(pic(4));
});

test("slime lanes step 5: a slime chews a tower; Repair mends it", async t => {
  await start(t, 5);
  await buyTower(t, 150, -30);
  // A tough slime right in front of it: it reaches the tower and chews.
  await slimeAt(t, 200, -30);
  await t.page(w => { const s = w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === "Slime").pop();
    for (const x of Object.values(s.variables) as any[]) if (x.name === "health") x.value = 999; });
  await t.frames(150);
  const hurt = (await towers(t))[0];
  t.expect(Number(hurt.vars.hp) < 20, `chewed: hp ${hurt.vars.hp}`);
  await t.frames(60);
  await t.screenshot(pic(5));
  await click(t, 120, -152);                 // the Repair tool
  await click(t, 150, -30);                  // the tower
  t.expect(Number((await towers(t))[0].vars.hp) >= 19, `repaired: hp ${(await towers(t))[0].vars.hp}`);
});

test("slime lanes step 6: upgrades: speed, damage (red bolts), pierce, strength; each costs coins", async t => {
  await start(t, 6);
  await t.page(w => { for (const x of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (x.name === "coins") x.value = 500; });
  await buyTower(t, -90, 30);
  for (const [tx, ty] of [[-120, -152], [-90, 30], [-60, -152], [-90, 30], [0, -152], [-90, 30], [60, -152], [-90, 30]]) await click(t, tx, ty);
  const tw = (await towers(t))[0];
  t.expect(Number(tw.vars.delay) === 0.35 && Number(tw.vars.power) === 2 && Number(tw.vars.pierce) === 1 && Number(tw.vars.maxhp) === 40,
    `upgraded: ${JSON.stringify(tw.vars)}`);
  t.expect(Number(await t.get("coins")) === 500 - 25 - 20 - 30 - 30 - 15, `coins ${await t.get("coins")}`);
  await t.frames(30);
  t.expect((await bolts(t)).every(b => b.costume === "power"), "red bolts");
  // Pierce: one bolt goes through two slimes.
  await slimeAt(t, 20, 30); await slimeAt(t, 60, 30);
  await t.frames(60);
  await t.screenshot(pic(6));
});

test("slime lanes step 7: waves get tougher; the castle falls when the lives run out", async t => {
  await start(t, 7);
  await t.page(w => { for (const x of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (x.name === "coins") x.value = 300; });
  for (const [x, y] of [[-150, 90], [-150, 30], [-150, -30], [-150, -90], [-90, 30], [-90, -30]]) await buyTower(t, x, y);
  for (let f = 0; f < 60 && Number(await t.get("wave")) < 3; f++) await t.frames(30);
  t.expect(Number(await t.get("wave")) >= 3, `wave ${await t.get("wave")}`);
  await t.screenshot(pic(7));
  await t.page(w => { for (const x of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (x.name === "lives") x.value = 0; });
  await t.frames(5);
  const said = await t.page(w => (w.vm.runtime.getSpriteTargetByName("Tower") as any).getCustomState?.("Scratch.looks")?.text);
  t.expect(String(said).startsWith("The slimes got in"), `says "${said}"`);
});
