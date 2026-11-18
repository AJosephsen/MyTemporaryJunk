// Tests for the Boom Lab tutorial (the whole lab is step 8). They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";
import { EFFECTS, BAR_Y, FLOOR, LAND_Y, buttonX } from "../games/boom-lab/project.ts";

const step = (n: number) => `tutorials/boom-lab/step${n}.sb3`;
const pic = (n: number) => new URL(`../tutorials/boom-lab/step${n}.png`, import.meta.url).pathname;
type C = { x: number; y: number; dir: number; size: number; ghost: number; costume: string; vars: Record<string, any> };
const clones = (t: T, name = "Boom") => t.page((w, name) => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === name)
  .map((c: any) => ({ x: c.x, y: c.y, dir: c.direction, size: c.size, ghost: c.effects.ghost, costume: c.getCostumes()[c.currentCostume].name,
    vars: Object.fromEntries((Object.values(c.variables) as any[]).map((x: any) => [x.name, x.value])) })), name) as Promise<C[]>;
const role = async (t: T, r: string) => (await clones(t)).filter(c => c.vars.role === r);
const sprite = (t: T, name: string) => t.page((w, n) => { const s = w.vm.runtime.getSpriteTargetByName(n); return { x: s.x, y: s.y, visible: s.visible }; }, name);
async function start(t: T, n: number, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(step(n)); await t.greenFlag(); await t.frames(3);
}
const click = async (t: T, x: number, y: number) => { await t.mouse(x, y, true); await t.frames(1); await t.mouse(x, y, false); await t.frames(1); };
const pick = (t: T, effect: string) => click(t, buttonX(EFFECTS.indexOf(effect)), BAR_Y);

test("boom lab step 1: a click in the sky plays the pop flip-book; the toolbar is not the sky", async t => {
  await start(t, 1);
  t.expect(await t.get("effect") === "pop", `effect ${await t.get("effect")}`);
  await click(t, 0, 60);
  let p = await role(t, "pop");
  t.expect(p.length === 1 && Math.abs(p[0].x) < 2 && Math.abs(p[0].y - 60) < 2, `a pop at the mouse: ${JSON.stringify(p.map(c => [c.x, c.y, c.costume]))}`);
  await t.frames(8);
  p = await role(t, "pop");
  t.expect(p.length === 1 && p[0].costume !== "pop1", `flips: ${p.map(c => c.costume)}`);
  await t.frames(20);
  t.expect((await role(t, "pop")).length === 0, "gone");
  await click(t, 100, BAR_Y);
  await t.frames(2);
  t.expect((await clones(t)).length === 0, "no pop on the toolbar");
  for (const [x, y] of [[-120, 80], [40, 20], [150, 110]]) { await click(t, x, y); await t.frames(3); }
  await t.screenshot(pic(1));
});

test("boom lab step 2: the fireball grows and fades", async t => {
  await start(t, 2);
  await pick(t, "fireball");
  t.expect(await t.get("effect") === "fireball", `picked ${await t.get("effect")}`);
  await click(t, 0, 40);
  const a = (await role(t, "fireball"))[0];
  await t.frames(6);
  const b = (await role(t, "fireball"))[0];
  t.expect(b.size > a.size && b.ghost > a.ghost, `grows ${a.size}→${b.size}, fades ${a.ghost}→${b.ghost}`);
  await click(t, -110, 90); await t.frames(3); await click(t, 120, 0); await t.frames(2);
  await t.screenshot(pic(2));
  await t.frames(30);
  t.expect((await role(t, "fireball")).length === 0, "gone");
});

for (const compiler of [true, false]) test(`boom lab step 3: a ring of 16 sparks, all pointing different ways (${compiler ? "compiled" : "interpreted"})`, async t => {
  await start(t, 3, compiler);
  await pick(t, "ring");
  await click(t, 0, 40);
  const s = await role(t, "spark");
  const dirs = new Set(s.map(c => Math.round(((c.dir % 360) + 360) % 360)));
  t.expect(s.length === 16 && dirs.size === 16, `16 sparks, ${dirs.size} directions`);
  await t.frames(6);
  if (compiler) { await click(t, -130, 90); await t.frames(3); await t.screenshot(pic(3)); }
});

test("boom lab step 4: embers fly up, slow down and fall (gravity)", async t => {
  await start(t, 4);
  await pick(t, "sparks");
  await click(t, 0, 0);
  const e = await role(t, "ember");
  t.expect(e.length === 20 && e.every(c => Number(c.vars.vy) > 0), `20 embers going up: ${e.map(c => c.vars.vy)}`);
  await t.frames(8);
  await click(t, -140, 40); await t.frames(4);
  await t.screenshot(pic(4));
  await t.frames(10);
  t.expect((await role(t, "ember")).every(c => Number(c.vars.vy) < 0), "falling now");
});

test("boom lab step 5: smoke puffs rise, grow and fade", async t => {
  await start(t, 5);
  await pick(t, "smoke");
  await click(t, 0, 0);
  await t.frames(8);
  const a = await role(t, "smoke");
  await t.frames(20);
  const b = await role(t, "smoke");
  const avg = (xs: number[]) => xs.reduce((p, x) => p + x, 0) / xs.length;
  t.expect(a.length === 6 && b.length === 6, `6 puffs: ${a.length}, ${b.length}`);
  t.expect(avg(b.map(c => c.y)) > avg(a.map(c => c.y)) + 10 && avg(b.map(c => c.size)) > avg(a.map(c => c.size)), "rising and growing");
  await click(t, -130, 60); await t.frames(10); await click(t, 130, 40); await t.frames(10);
  await t.screenshot(pic(5));
});

test("boom lab step 6: the blast flashes the screen and sends out a shockwave", async t => {
  await start(t, 6);
  await pick(t, "blast");
  await click(t, 0, 40);
  t.expect((await sprite(t, "Flash")).visible, "flash");
  t.expect((await role(t, "shock")).length === 1 && (await role(t, "fireball")).length === 1 && (await role(t, "spark")).length === 12, "shockwave, fireball, ring");
  await t.frames(4);
  await t.screenshot(pic(6));
  await t.frames(10);
  t.expect(!(await sprite(t, "Flash")).visible, "the flash is over");
});

test("boom lab step 7: the quake shakes the ground, then it is back home", async t => {
  await start(t, 7);
  await pick(t, "quake");
  await click(t, 0, -60);
  let moved = false;
  for (let i = 0; i < 6; i++) { const l = await sprite(t, "Land"); moved ||= l.x !== 0 || l.y !== LAND_Y; await t.frames(1); }
  t.expect(moved, "shaking");
  await t.frames(2);
  await t.screenshot(pic(7));
  await t.frames(20);
  const l = await sprite(t, "Land");
  t.expect(l.x === 0 && l.y === LAND_Y, `home: ${l.x}, ${l.y}`);
});

for (const compiler of [true, false]) test(`boom lab step 8: mega sets off everything; debris bounces on the ground (${compiler ? "compiled" : "interpreted"})`, async t => {
  await start(t, 8, compiler);
  await pick(t, "mega");
  await click(t, 0, -40);
  const roles = new Set((await clones(t)).map(c => c.vars.role));
  t.expect(["shock", "fireball", "spark", "ember", "smoke", "chunk"].every(r => roles.has(r)) && (await sprite(t, "Flash")).visible, `everything: ${[...roles]}`);
  let lowest = 999, bounced = false;
  for (let i = 0; i < 50; i++) {
    await t.frames(1);
    for (const c of await role(t, "chunk")) { lowest = Math.min(lowest, c.y); bounced ||= c.y <= FLOOR + 1 && Number(c.vars.vy) > 0; }
    if (compiler && i === 6) await t.screenshot(pic(8));
  }
  t.expect(bounced && lowest > FLOOR - 12, `bounced, lowest ${lowest}`);
});
