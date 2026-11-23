// Tests for the Gift Factory tutorial (the game is step 6). They also take the tutorial's pictures.
import { test, type T } from "../workbench/testing.ts";
import { RIDE_Y, BASKET_Y, basketX } from "../games/gift-factory/project.ts";

const step = (n: number) => `tutorials/gift-factory/step${n}.sb3`;
const pic = (n: number) => new URL(`../tutorials/gift-factory/step${n}.png`, import.meta.url).pathname;
type C = { x: number; y: number; costume: string; vars: Record<string, any> };
const clones = (t: T, name: string) => t.page((w, n) => w.vm.runtime.targets.filter((c: any) => !c.isOriginal && c.sprite.name === n)
  .map((c: any) => ({ x: c.x, y: c.y, costume: c.getCostumes()[c.currentCostume].name,
    vars: Object.fromEntries((Object.values(c.variables) as any[]).map((v: any) => [v.name, v.value])) })), name) as Promise<C[]>;
const gifts = (t: T) => clones(t, "Gift");
async function start(t: T, n: number, compiler = true) {
  await t.page((w, on) => w.vm.setCompilerOptions({ enabled: on }), compiler);
  await t.load(step(n)); await t.greenFlag(); await t.frames(3);
}
// No new gifts from the hatch: stop the Gift sprite's own script.
const noSpawns = (t: T) => t.page(w => { const s = w.vm.runtime.getSpriteTargetByName("Gift");
  for (const th of w.vm.runtime.threads.filter((x: any) => x.target === s)) w.vm.runtime._stopThread(th); });
// A gift of a kind (1 red, 2 green, 3 blue, 4 gold) at x on the belt, made the way "create clone" does.
const giftAt = (t: T, kind: number, x: number) => t.page((w, [k, x, y]) => {
  const rt = w.vm.runtime, s = rt.getSpriteTargetByName("Gift");
  for (const v of Object.values(s.variables) as any[]) if (v.name === "kind") v.value = k;
  s.setCostume(k - 1); s.setXY(x, y);
  const c = s.makeClone(); rt.addTarget(c);
}, [kind, x, RIDE_Y]);
// Press on a gift, drag it (the mouse moves while the button is down) and let go.
async function drag(t: T, from: [number, number], to: [number, number]) {
  await t.mouse(from[0], from[1], true); await t.frames(2);
  for (let i = 1; i <= 6; i++) { await t.mouse(from[0] + (to[0] - from[0]) * i / 6, from[1] + (to[1] - from[1]) * i / 6, true); await t.frames(1); }
  await t.mouse(to[0], to[1], false); await t.frames(2);
}
const list = (t: T, name: string) => t.page((w, n) => (Object.values(w.vm.runtime.getTargetForStage().variables) as any[]).find((v: any) => v.name === n && v.type === "list")?.value.map(Number), name) as Promise<number[]>;
const setList = (t: T, name: string, value: number[]) => t.page((w, [n, x]) => {
  for (const v of Object.values(w.vm.runtime.getTargetForStage().variables) as any[]) if (v.name === n && v.type === "list") v.value = x; }, [name, value]);

test("gift factory step 1: gifts come out of the hatch and ride the belt to the right; at the end they fall off", async t => {
  await start(t, 1);
  await t.frames(90);
  const a = await gifts(t);
  t.expect(a.length >= 1 && a.every(g => g.y === RIDE_Y), `on the belt: ${JSON.stringify(a.map(g => [g.x, g.y]))}`);
  await t.frames(10);
  const b = await gifts(t);
  t.expect(Math.abs(b[0].x - a[0].x - 12) < 0.5, `rides right, 1.2 a frame: ${a[0].x} -> ${b[0].x}`);
  await noSpawns(t);
  await giftAt(t, 2, 215);
  await t.frames(40);
  t.expect((await gifts(t)).every(g => g.x < 215), "the one at the end fell off");
  await t.frames(150);
  await t.screenshot(pic(1));
});

for (const compiler of [true, false]) test(`gift factory step 2: drag a gift and let go: it flies up, zigzags down and rides again (${compiler ? "compiled" : "interpreted"})`, async t => {
  await start(t, 2, compiler);
  await noSpawns(t);
  await giftAt(t, 1, -100);
  await t.frames(2);
  const g0 = (await gifts(t))[0];
  await drag(t, [g0.x, g0.y], [-40, 110]);
  let g = (await gifts(t))[0];
  t.expect(g.vars.state === "air", `in the air: ${g.vars.state}`);
  const xs: number[] = [];
  for (let f = 0; f < 200 && g.vars.state !== "belt"; f++) { await t.frames(1); g = (await gifts(t))[0]; xs.push(g.x); if (compiler && f === 25) await t.screenshot(pic(2)); }
  t.expect(g.vars.state === "belt" && g.y === RIDE_Y, `landed on the belt: ${g.vars.state} ${g.y}`);
  t.expect(Math.max(...xs) - Math.min(...xs) > 20, `zigzags: x from ${Math.min(...xs)} to ${Math.max(...xs)}`);
});

test("gift factory step 3: the right basket takes the gift (score 10); the wrong one throws it back up", async t => {
  await start(t, 3);
  await noSpawns(t);
  await giftAt(t, 1, -120);
  await t.frames(2);
  let g = (await gifts(t))[0];
  await drag(t, [g.x, g.y], [basketX(1), BASKET_Y + 20]);
  await t.frames(10);
  t.expect(Number(await t.get("score")) === 10 && (await list(t, "fill")).join() === "1,0,0" && (await gifts(t)).length === 0, `in: ${await t.get("score")} ${await list(t, "fill")}`);
  await giftAt(t, 2, -60);
  await t.frames(2);
  g = (await gifts(t))[0];
  await drag(t, [g.x, g.y], [basketX(3), BASKET_Y + 20]);
  t.expect((await gifts(t))[0].vars.state === "air" && Number(await t.get("score")) === 10, "wrong basket: thrown back up");
  await setList(t, "fill", [3, 2, 4]);
  await giftAt(t, 3, -160); await t.frames(40); await giftAt(t, 1, -190);
  await t.frames(20);
  await t.screenshot(pic(3));
});

test("gift factory step 4: a full basket glides away and comes back empty; meanwhile it is busy", async t => {
  await start(t, 4);
  await noSpawns(t);
  await setList(t, "fill", [4, 0, 0]);
  await giftAt(t, 1, -120);
  await t.frames(2);
  let g = (await gifts(t))[0];
  await drag(t, [g.x, g.y], [basketX(1), BASKET_Y + 20]);
  await t.frames(30);
  t.expect((await list(t, "fill"))[0] === 5, `full: ${await list(t, "fill")}`);
  const away = (await clones(t, "Basket")).find(b => Math.abs(b.x - basketX(1)) < 1)!;
  t.expect(away.y < BASKET_Y - 60, `gliding away: y ${away.y}`);
  await t.screenshot(pic(4));
  await giftAt(t, 1, -100);
  await t.frames(2);
  g = (await gifts(t))[0];
  await drag(t, [g.x, g.y], [basketX(1), BASKET_Y + 40]);
  t.expect((await gifts(t))[0].vars.state === "air", "busy: thrown up");
  await t.until(v => v.fill?.[0] == 0, { max: 200, what: "the basket to be emptied" });
  await t.frames(40);
  const back = (await clones(t, "Basket")).find(b => Math.abs(b.x - basketX(1)) < 1)!;
  t.expect(back.y === BASKET_Y && back.costume === "red0", `back, empty: ${back.y} ${back.costume}`);
});

test("gift factory step 5: gifts that fall off are missed; at 5 the factory closes", async t => {
  await start(t, 5);
  await noSpawns(t);
  await t.set("missed", 3);
  await giftAt(t, 2, 210);
  await t.frames(40);
  t.expect(Number(await t.get("missed")) === 4, `missed ${await t.get("missed")}`);
  await giftAt(t, 3, -150); await giftAt(t, 1, 0);
  await t.frames(10);
  await t.screenshot(pic(5));
  await giftAt(t, 1, 222);
  await t.frames(30);
  const said = await t.page(w => (w.vm.runtime.getSpriteTargetByName("Belt") as any).getCustomState?.("Scratch.looks")?.text);
  t.expect(String(said).startsWith("The factory is closed"), `says "${said}"`);
});

test("gift factory step 6: a gold gift fits any basket and scores 50; sorting speeds the belt up", async t => {
  await start(t, 6);
  await noSpawns(t);
  await giftAt(t, 4, -120);
  await t.frames(2);
  const g = (await gifts(t))[0];
  t.expect(g.costume === "gold", `gold: ${g.costume}`);
  await drag(t, [g.x, g.y], [basketX(2), BASKET_Y + 20]);
  await t.frames(10);
  t.expect(Number(await t.get("score")) === 50 && Number(await t.get("speed")) > 1, `score ${await t.get("score")}, speed ${await t.get("speed")}`);
  // The real hatch again, for the picture.
  await t.greenFlag(); await t.frames(3);
  await setList(t, "fill", [2, 4, 1]);
  await t.set("speed", 1.8);
  await giftAt(t, 4, -60);
  await t.frames(150);
  await t.screenshot(pic(6));
});
